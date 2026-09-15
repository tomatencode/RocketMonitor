import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";

interface ScrollViewProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    /** Auto-scroll to the bottom when content grows, but only if already scrolled to the bottom */
    stickToBottom?: boolean;
    /** Where the view is scrolled to on mount */
    initialScrollPosition?: "top" | "bottom";
    /** Fade the top or bottom edge while there's more content to scroll to in that direction */
    gradientEdges?: boolean;
    /** CSS color the edge gradient fully transitions to at the very edge */
    gradientColor?: string;
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
    stickToBottom = false,
    initialScrollPosition = "top",
    gradientEdges = false,
    gradientColor = "#18181b",
    className = "",
    ...props
}: ScrollViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const isAutoScrollingRef = useRef(false);
    const autoScrollFrameRef = useRef<number | null>(null);
    const lastAutoScrollFrameTimeRef = useRef<number | null>(null);
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
            <div ref={scrollRef} onScroll={updateScrollState} className="h-full overflow-y-auto" {...props}>
                <div ref={contentRef} className={className}>{children}</div>
            </div>
            {gradientEdges && topGradientSize > 0 && (
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
            {gradientEdges && bottomGradientSize > 0 && (
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
        </div>
    );
}
