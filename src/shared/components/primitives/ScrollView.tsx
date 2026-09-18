import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode, type RefObject } from "react";

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
// How long after the last wheel/touchmove/scrollbar-release we still treat scroll events as user-driven,
// to cover momentum scrolling without letting unrelated (e.g. virtualizer) scroll events unstick us.
const USER_GESTURE_GRACE_MS = 400;

interface ScrollState {
    /** Currently scrolled (within threshold of) the bottom. */
    atBottom: boolean;
    /** The catch-up animation is actively driving scrollTop right now. */
    autoScrolling: boolean;
    /** A real user gesture (wheel/touch/scrollbar-drag), plus grace period, is in progress. */
    userGestureActive: boolean;
    /** rAF handle for the in-progress catch-up animation, if any. */
    frame: number | null;
    /** Timestamp of the catch-up animation's previous frame, for frame-rate-independent easing. */
    frameTime: number | null;
}

/** Tracks whether a user gesture is ongoing, with a grace period after the last `extend()` call
 * so momentum scrolling still counts as user-driven. Scroll events outside this window (auto-scroll,
 * browser scroll anchoring, virtualized rows resizing as they're measured, etc.) must never unstick us. */
function createUserGestureTracker(state: ScrollState, graceMs: number) {
    let idleTimeout: number | null = null;
    return {
        start() {
            state.userGestureActive = true;
            if (idleTimeout !== null) window.clearTimeout(idleTimeout);
        },
        extend() {
            if (idleTimeout !== null) window.clearTimeout(idleTimeout);
            idleTimeout = window.setTimeout(() => { state.userGestureActive = false; }, graceMs);
        },
        dispose() {
            if (idleTimeout !== null) window.clearTimeout(idleTimeout);
        },
    };
}

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
    const state = useRef<ScrollState>({ atBottom: true, autoScrolling: false, userGestureActive: false, frame: null, frameTime: null }).current;

    const isPinnedToBottom = stickToBottom && (state.atBottom || state.autoScrolling);
    
    const [topGradientSize, setTopGradientSize] = useState(0);
    const [bottomGradientSize, setBottomGradientSize] = useState(0);

    function updateScrollState() {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromTop = el.scrollTop;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (!state.autoScrolling) {
            if (distanceFromBottom < BOTTOM_THRESHOLD_PX) state.atBottom = true;
            else if (state.userGestureActive) state.atBottom = false;
        }
        setTopGradientSize(Math.min(distanceFromTop, MAX_GRADIENT_PX));
        setBottomGradientSize(Math.min(distanceFromBottom, MAX_GRADIENT_PX));
    }

    function animateToBottom(timestamp: number) {
        const scroll = scrollRef.current;
        if (!scroll || !state.autoScrolling) return;

        const target = scroll.scrollHeight - scroll.clientHeight;
        const distance = target - scroll.scrollTop;
        if (distance <= 1) {
            scroll.scrollTop = target;
            state.autoScrolling = false;
            state.frame = null;
            state.frameTime = null;
            updateScrollState();
            return;
        }

        const dt = state.frameTime === null ? 16 : Math.min(timestamp - state.frameTime, 100);
        state.frameTime = timestamp;

        if (distance > scroll.clientHeight * SNAP_THRESHOLD_VIEWPORTS) {
            scroll.scrollTop = target;
        } else {
            const catchUpFraction = 1 - Math.exp(-dt / CATCH_UP_TAU_MS);
            scroll.scrollTop += Math.max(distance * catchUpFraction, 1);
        }
        updateScrollState();
        state.frame = requestAnimationFrame(animateToBottom);
    }

    function startAutoScroll() {
        state.autoScrolling = true;
        if (state.frame === null) {
            state.frameTime = null;
            state.frame = requestAnimationFrame(animateToBottom);
        }
    }

    useLayoutEffect(() => {
        const scroll = scrollRef.current;
        if (!scroll) return;

        state.autoScrolling = false;
        if (initialScrollPosition === "bottom") {
            scroll.scrollTop = scroll.scrollHeight;
            state.atBottom = true;
        }
        updateScrollState();

        const content = contentRef.current;
        if (!content) return;

        const gesture = createUserGestureTracker(state, USER_GESTURE_GRACE_MS);

        const cancelAutoScroll = () => {
            state.autoScrolling = false;
            if (state.frame !== null) {
                cancelAnimationFrame(state.frame);
                state.frame = null;
            }
            state.frameTime = null;
            updateScrollState();
        };
        const onWheelOrTouchMove = () => {
            gesture.start();
            gesture.extend();
            cancelAutoScroll();
        };
        // Only a real scroll gesture should be able to unstick from the bottom - a click/tap on
        // content (e.g. a button in a log row) must not interrupt an in-progress catch-up animation.
        const onPointerDown = (event: PointerEvent) => {
            // Dragging the scrollbar thumb (or clicking its track) doesn't fire wheel/touchmove and
            // doesn't hit any content, so `target` is the scroll container itself - unlike a click on
            // content, which always targets a descendant. offsetX/clientWidth isn't reliable here since
            // overlay scrollbars don't reserve any layout width.
            if (event.target !== scroll) return;
            gesture.start();
            cancelAutoScroll();
            const onPointerUp = () => { gesture.extend(); window.removeEventListener("pointerup", onPointerUp); };
            window.addEventListener("pointerup", onPointerUp);
        };
        scroll.addEventListener("wheel", onWheelOrTouchMove, { passive: true });
        scroll.addEventListener("touchmove", onWheelOrTouchMove, { passive: true });
        scroll.addEventListener("pointerdown", onPointerDown);

        // Content can grow without the scroll container firing a "scroll" event, so watch its size directly
        const observer = new ResizeObserver(() => {
            if (stickToBottom && (state.atBottom || state.autoScrolling)) {
                startAutoScroll();
            }
            updateScrollState();
        });
        observer.observe(content);
        return () => {
            observer.disconnect();
            gesture.dispose();
            if (state.frame !== null) {
                cancelAnimationFrame(state.frame);
                state.frame = null;
            }
            scroll.removeEventListener("wheel", onWheelOrTouchMove);
            scroll.removeEventListener("touchmove", onWheelOrTouchMove);
            scroll.removeEventListener("pointerdown", onPointerDown);
        };
    }, [stickToBottom, initialScrollPosition]);

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
                // Prevents the browser's scroll-anchoring from silently nudging scrollTop (e.g. when
                // virtualized rows above the viewport get remeasured), which was firing spurious
                // "scroll" events that reset isAtBottomRef before our own resize handling could react.
                style={{ overflowAnchor: "none", ...props.style }}
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
