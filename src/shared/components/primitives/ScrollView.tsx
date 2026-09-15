import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode, type RefObject } from "react";

export interface ScrollViewProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    /** Receives the element that owns scrolling. */
    scrollElementRef?: RefObject<HTMLDivElement | null>;
    /** Auto-scroll to the bottom when content grows, but only if already scrolled to the bottom */
    stickToBottom?: boolean;
    /** Where the view is scrolled to on mount */
    initialScrollPosition?: "top" | "bottom";
    /** Fade both top and bottom edges while there's more content to scroll to */
    gradientEdges?: boolean;
    /** Fade the top edge while there's more content to scroll up to */
    gradientTop?: boolean;
    /** Fade the bottom edge while there's more content to scroll down to */
    gradientBottom?: boolean;
    /** CSS color the edge gradient fully transitions to at the very edge */
    gradientColor?: string;
    /** Blur both top and bottom edges while there's more content to scroll to */
    blurEdges?: boolean;
    /** Blur the top edge while there's more content to scroll up to */
    blurTop?: boolean;
    /** Blur the bottom edge while there's more content to scroll down to */
    blurBottom?: boolean;
    /** CSS blur radius for the blurred edge (default: "8px") */
    blurRadius?: string;
}

const BOTTOM_THRESHOLD_PX = 32;
const MAX_GRADIENT_PX = 48;
// Time constant for the catch-up ease; smaller = snappier. Frame-rate independent so bursts of
// fast-growing content can't outrun it the way a fixed per-frame percentage would.
const CATCH_UP_TAU_MS = 80;
// If the gap grows beyond this many viewport heights (e.g. a huge chunk of content lands at once),
// snap straight to the bottom instead of easing, so we never visibly trail behind while pinned.
const SNAP_THRESHOLD_VIEWPORTS = 2;

export function ScrollView({
    children,
    scrollElementRef,
    stickToBottom = false,
    initialScrollPosition = "top",
    gradientEdges = false,
    gradientTop,
    gradientBottom,
    gradientColor = "#18181b",
    blurEdges = false,
    blurTop,
    blurBottom,
    blurRadius = "8px",
    className = "",
    ...props
}: ScrollViewProps) {
    const showGradientTop = Boolean(gradientTop ?? gradientEdges);
    const showGradientBottom = Boolean(gradientBottom ?? gradientEdges);
    const showBlurTop = Boolean(blurTop ?? blurEdges);
    const showBlurBottom = Boolean(blurBottom ?? blurEdges);

    if (showGradientTop && showBlurTop) {
        throw new Error("ScrollView cannot use both gradient and blur on the top edge.");
    }
    if (showGradientBottom && showBlurBottom) {
        throw new Error("ScrollView cannot use both gradient and blur on the bottom edge.");
    }
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const isAutoScrollingRef = useRef(false);
    const autoScrollFrameRef = useRef<number | null>(null);
    const lastAutoScrollFrameTimeRef = useRef<number | null>(null);

    const isPinnedToBottom = stickToBottom && (isAtBottomRef.current || isAutoScrollingRef.current);
    
    const [topGradientSize, setTopGradientSize] = useState(0);
    const [bottomGradientSize, setBottomGradientSize] = useState(0);

    function updateScrollState() {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromTop = el.scrollTop;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (!isAutoScrollingRef.current) {
            isAtBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD_PX;
        }
        setTopGradientSize(Math.min(distanceFromTop, MAX_GRADIENT_PX));
        setBottomGradientSize(Math.min(distanceFromBottom, MAX_GRADIENT_PX));
    }

    function animateToBottom(timestamp: number) {
        const scroll = scrollRef.current;
        if (!scroll || !isAutoScrollingRef.current) return;

        const target = scroll.scrollHeight - scroll.clientHeight;
        const distance = target - scroll.scrollTop;
        if (distance <= 1) {
            scroll.scrollTop = target;
            isAutoScrollingRef.current = false;
            autoScrollFrameRef.current = null;
            lastAutoScrollFrameTimeRef.current = null;
            updateScrollState();
            return;
        }

        const lastTime = lastAutoScrollFrameTimeRef.current;
        lastAutoScrollFrameTimeRef.current = timestamp;
        const dt = lastTime === null ? 16 : Math.min(timestamp - lastTime, 100);

        if (distance > scroll.clientHeight * SNAP_THRESHOLD_VIEWPORTS) {
            scroll.scrollTop = target;
        } else {
            const catchUpFraction = 1 - Math.exp(-dt / CATCH_UP_TAU_MS);
            scroll.scrollTop += Math.max(distance * catchUpFraction, 1);
        }
        updateScrollState();
        autoScrollFrameRef.current = requestAnimationFrame(animateToBottom);
    }

    function startAutoScroll() {
        isAutoScrollingRef.current = true;
        if (autoScrollFrameRef.current === null) {
            lastAutoScrollFrameTimeRef.current = null;
            autoScrollFrameRef.current = requestAnimationFrame(animateToBottom);
        }
    }

    useEffect(() => {
        const scroll = scrollRef.current;
        if (!scroll) return;

        isAutoScrollingRef.current = false;
        if (initialScrollPosition === "bottom") scroll.scrollTop = scroll.scrollHeight;
        updateScrollState();

        const content = contentRef.current;
        if (!content) return;

        const cancelAutoScroll = () => {
            isAutoScrollingRef.current = false;
            if (autoScrollFrameRef.current !== null) {
                cancelAnimationFrame(autoScrollFrameRef.current);
                autoScrollFrameRef.current = null;
            }
            lastAutoScrollFrameTimeRef.current = null;
            updateScrollState();
        };
        scroll.addEventListener("wheel", cancelAutoScroll);
        scroll.addEventListener("touchstart", cancelAutoScroll);
        scroll.addEventListener("pointerdown", cancelAutoScroll);

        // Content can grow without the scroll container firing a "scroll" event, so watch its size directly
        const observer = new ResizeObserver(() => {
            if (stickToBottom && (isAtBottomRef.current || isAutoScrollingRef.current)) {
                startAutoScroll();
            }
            updateScrollState();
        });
        observer.observe(content);
        return () => {
            observer.disconnect();
            if (autoScrollFrameRef.current !== null) {
                cancelAnimationFrame(autoScrollFrameRef.current);
                autoScrollFrameRef.current = null;
            }
            scroll.removeEventListener("wheel", cancelAutoScroll);
            scroll.removeEventListener("touchstart", cancelAutoScroll);
            scroll.removeEventListener("pointerdown", cancelAutoScroll);
        };
    }, [stickToBottom]);

    return (
        <div className="relative h-full min-h-0">
            <div
                ref={(element) => {
                    scrollRef.current = element;
                    if (scrollElementRef) scrollElementRef.current = element;
                }}
                onScroll={updateScrollState}
                className="h-full overflow-y-auto"
                {...props}
            >
                <div ref={contentRef} className={className}>{children}</div>
            </div>
            {showGradientTop && topGradientSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{
                        height: topGradientSize,
                        backgroundImage: `linear-gradient(to bottom, ${gradientColor}, transparent)`,
                        maskImage: "linear-gradient(to bottom, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
                    }}
                />
            )}
            {showGradientBottom && !isPinnedToBottom && bottomGradientSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0"
                    style={{
                        height: bottomGradientSize,
                        backgroundImage: `linear-gradient(to top, ${gradientColor}, transparent)`,
                        maskImage: "linear-gradient(to top, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to top, black, transparent)",
                    }}
                />
            )}
            {showBlurTop && topGradientSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{
                        height: topGradientSize,
                        backdropFilter: `blur(${blurRadius})`,
                        WebkitBackdropFilter: `blur(${blurRadius})`,
                        maskImage: "linear-gradient(to bottom, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
                    }}
                />
            )}
            {showBlurBottom && !isPinnedToBottom && bottomGradientSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0"
                    style={{
                        height: bottomGradientSize,
                        backdropFilter: `blur(${blurRadius})`,
                        WebkitBackdropFilter: `blur(${blurRadius})`,
                        maskImage: "linear-gradient(to top, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to top, black, transparent)",
                    }}
                />
            )}
        </div>
    );
}
