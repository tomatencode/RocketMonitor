import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";

interface ScrollViewProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    /** Auto-scroll to the bottom when content grows, but only if already scrolled to the bottom */
    stickToBottom?: boolean;
    /** Fade/blur the top or bottom edge while there's more content to scroll to in that direction */
    blurEdges?: boolean;
    /** CSS color the edge blur fully transitions to at the very edge */
    blurColor?: string;
}

const BOTTOM_THRESHOLD_PX = 32;
const MAX_BLUR_PX = 48;

export function ScrollView({
    children,
    stickToBottom = false,
    blurEdges = false,
    blurColor = "#18181b",
    className = "",
    ...props
}: ScrollViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const [topBlurSize, setTopBlurSize] = useState(0);
    const [bottomBlurSize, setBottomBlurSize] = useState(0);

    function updateScrollState() {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromTop = el.scrollTop;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        isAtBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD_PX;
        setTopBlurSize(Math.min(distanceFromTop, MAX_BLUR_PX));
        setBottomBlurSize(Math.min(distanceFromBottom, MAX_BLUR_PX));
    }

    useEffect(() => {
        updateScrollState();

        const content = contentRef.current;
        if (!content) return;

        // Content can grow without the scroll container firing a "scroll" event, so watch its size directly
        const observer = new ResizeObserver(() => {
            if (stickToBottom && isAtBottomRef.current) {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
            }
            updateScrollState();
        });
        observer.observe(content);
        return () => observer.disconnect();
    }, [stickToBottom]);

    return (
        <div className="relative h-full min-h-0">
            <div ref={scrollRef} onScroll={updateScrollState} className="h-full overflow-y-auto" {...props}>
                <div ref={contentRef} className={className}>{children}</div>
            </div>
            {blurEdges && topBlurSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 backdrop-blur-lg"
                    style={{
                        height: topBlurSize,
                        backgroundImage: `linear-gradient(to bottom, ${blurColor}, transparent)`,
                        maskImage: "linear-gradient(to bottom, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
                    }}
                />
            )}
            {blurEdges && bottomBlurSize > 0 && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 backdrop-blur-lg"
                    style={{
                        height: bottomBlurSize,
                        backgroundImage: `linear-gradient(to top, ${blurColor}, transparent)`,
                        maskImage: "linear-gradient(to top, black, transparent)",
                        WebkitMaskImage: "linear-gradient(to top, black, transparent)",
                    }}
                />
            )}
        </div>
    );
}
