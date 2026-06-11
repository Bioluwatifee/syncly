import { useState, useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

// ─────────────────────────────────────────────────────────────────────────────
// BREAKPOINTS
// ─────────────────────────────────────────────────────────────────────────────
const BP_PHONE  = 480
const BP_TABLET = 810

// ─────────────────────────────────────────────────────────────────────────────
// FEED GRID COLUMNS
// ─────────────────────────────────────────────────────────────────────────────
const FEED_COLS_PHONE   = 2
const FEED_COLS_TABLET  = 3
const FEED_COLS_DESKTOP = 4

// ─────────────────────────────────────────────────────────────────────────────
// STICKY TAB BAR
// ─────────────────────────────────────────────────────────────────────────────
const TAB_STICKY_TOP = 16

// ─────────────────────────────────────────────────────────────────────────────
// MOTION
// Shared animation language — entrance rise, stagger, blur-up, tab cross-fade
// ─────────────────────────────────────────────────────────────────────────────
const EASING        = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
const PILL_EASING   = "cubic-bezier(0.22, 1, 0.36, 1)"   // power3.out — sliding pill
const ENTER_RISE    = 18      // px items rise from on entrance
const ENTER_TIME    = 0.55    // s per-item entrance duration
const ENTER_BLUR    = 16      // px blur items sharpen from on entrance
const STAGGER_MS    = 45      // ms delay between items
const STAGGER_CAP   = 540     // ms max total delay so long feeds don't crawl
const TAB_OUT_MS    = 180     // ms content fade-out before swap
const HOVER_ZOOM    = 1.045   // feed image scale on hover

// ─────────────────────────────────────────────────────────────────────────────
// FEED DEFAULTS
// These are the fallback images shown when no overrides are set via the panel.
// Animated GIFs work here too — they play inline automatically.
// To replace any image: select TabSection → right panel → Feed Items → add
// items there. Once you add even one item to the panel, the panel list takes
// over entirely and these defaults are ignored.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_FEED_ITEMS = [
    { image: "https://framerusercontent.com/images/K48BAHfETLJLNfoki9ZE4jM8aLU.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/HtBvq7r1j16G7xCzBl7GJUmHsQ.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/2LibDpbbxoPs5IXwp4nFVUJjvQ.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/lHmrlvhiCldbELKKj6sEAqmCoU.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/bYXfNcCmrWkp28m7pIqnFwlsg.png",   title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/0SA0Y1JruRiUSSxKYWCU7H9L7w.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/vwB0vtnaGZ7tcC1mf9NsibKJ6KA.png", title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/YUGsninrT0pc4tasdWEhTCtZb8.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/55GgkptZkcSAokb0jBO3eUk7duE.png", title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/02xO2NzPxp2Ia8JQg6w2zByipA.png",  title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/vdG1esl3v89Zi8evX8RqwsVj0.png",   title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/RrFdsFkRxO4yjZYTgOHjAiSn0.png",   title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/cq2xo6kxdJ33L1ALaow1xL409IA.png", title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/OyjT5wgnAZNq2WV0MVVlRCWELVk.png", title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/l1gJTAaEBc6NdaTuNCFSDeUFkdw.png", title: "", tag: "", link: "" },
    { image: "https://framerusercontent.com/images/OH4VxoUUlBYx9kd1VODDgsDFo0.png",  title: "", tag: "", link: "" },
]

// ─────────────────────────────────────────────────────────────────────────────
// WORK CARDS — desktop / tablet
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
import VendyDesktop     from "https://framer.com/m/Vendy-s-UPA-TnmDeG.js"
// @ts-ignore
import SmartcartDesktop from "https://framer.com/m/Smartcart-rbuuLc.js"
// @ts-ignore
import CarpoolDesktop   from "https://framer.com/m/Carpool-8psjhG.js"
// @ts-ignore
import ShopeaseDesktop  from "https://framer.com/m/Shopease-0s52s4.js"
// @ts-ignore
import LeYouDesktop     from "https://framer.com/m/LeYou-Exchange-Dyh7vP.js"

// ─────────────────────────────────────────────────────────────────────────────
// WORK CARDS — mobile
// ⚠️  If Vendy looks wrong on mobile, swap 0I5WaU → kbh3m9
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
import VendyMobile      from "https://framer.com/m/Vendy-s-UPA-0I5WaU.js"
// @ts-ignore
import SmartcartMobile  from "https://framer.com/m/Smartcart-mobile-mDv2GZ.js"
// @ts-ignore
import CarpoolMobile    from "https://framer.com/m/Carpool-mobile-2FTx2P.js"
// @ts-ignore
import ShopeaseMobile   from "https://framer.com/m/Shopease-mobile-91f7q9.js"
// @ts-ignore
import LeYouMobile      from "https://framer.com/m/Leyou-mobile-78fxmN.js"

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL JOURNEY CARDS
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
import VendyWork      from "https://framer.com/m/vendy-HnPztU.js"
// @ts-ignore
import AcedboardWork  from "https://framer.com/m/Acedboard-dHkChV.js"
// @ts-ignore
import KoectinWork    from "https://framer.com/m/Koectin-nZ4vdp.js"

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL JOURNEY — variant IDs per breakpoint
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = {
    desktop: { vendy: "HDJQDXnG8", acedboard: "lXByPMKBy",  koectin: "OT0rBoYi9" },
    tablet:  { vendy: "ODNV7FVry", acedboard: "memv2WoOV",  koectin: "YHHVr4jtJ" },
    phone:   { vendy: "YZvsZZus8", acedboard: "wJru680mR",  koectin: "AdCJQPlKp" },
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL JOURNEY — heading icons
// ─────────────────────────────────────────────────────────────────────────────
const ICONS = [
    "https://framerusercontent.com/images/JI97CqIqqvvn5llShDalXszt7y8.png",
    "https://framerusercontent.com/images/arYSfxPkLdDkqirztk55GmELD0.png",
    "https://framerusercontent.com/images/JHnf90iUMQ35lbiAz6u3SF7lg.png",
    "https://framerusercontent.com/images/7W0wXnWeU0MEJRhqUK0gJu4Y7r8.png",
]

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "Feed" | "Work" | "Projects"

interface FeedItem {
    image: string
    title: string
    tag: string
    link: string
}

interface TabSectionProps {
    feedItems: FeedItem[]
    projectTitle: string
    projectDescription: string
    projectTags: string
    projectImage: string
    projectLink: string
    activeFontWeight: number
    inactiveFontWeight: number
    activeTextColor: string
    inactiveTextColor: string
    containerColor: string
    activeTabColor: string
    fontSize: number
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function useWindowWidth() {
    const [width, setWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1440
    )
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return width
}

// Flips to true right after mount/key-change so CSS transitions can play.
// Double rAF guarantees the browser paints the "from" state first.
function useEntered(deps: any[]) {
    const [entered, setEntered] = useState(false)
    useEffect(() => {
        setEntered(false)
        let raf2: number
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setEntered(true))
        })
        return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
    }, deps)
    return entered
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED GRID — staggered entrance + blur-up reveal + hover zoom
// Structure per tile:
//   <a> wrapper  — entrance: opacity + rise (staggered)
//   tile div     — rounded mask, overflow hidden
//   zoom div     — hover scale (CSS class, so its transition has no stagger delay)
//   <img>        — blur-up: sharpens with the same stagger delay
// ─────────────────────────────────────────────────────────────────────────────
function FeedGrid({ items, columns, gap, entered }: { items: FeedItem[]; columns: number; gap: number; entered: boolean }) {
    return (
        <>
            <style>{`
                .syncly-feed-zoom {
                    width: 100%;
                    height: 100%;
                    transition: transform 0.45s ${EASING};
                    will-change: transform;
                }
                .syncly-feed-item:hover .syncly-feed-zoom {
                    transform: scale(${HOVER_ZOOM});
                }
            `}</style>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px`, width: "100%" }}>
                {items.map((item, i) => {
                    const delay = Math.min(i * STAGGER_MS, STAGGER_CAP)
                    return (
                        <a key={i} href={item.link || undefined} target={item.link ? "_blank" : undefined}
                            rel="noreferrer"
                            className="syncly-feed-item"
                            style={{
                                textDecoration: "none",
                                display: "block",
                                opacity: entered ? 1 : 0,
                                transform: entered ? "none" : `translateY(${ENTER_RISE}px)`,
                                transition: `opacity ${ENTER_TIME}s ${EASING} ${delay}ms, transform ${ENTER_TIME}s ${EASING} ${delay}ms`,
                                willChange: "opacity, transform",
                            }}>
                            <div style={{ borderRadius: "16px", overflow: "hidden", backgroundColor: "rgb(245,245,245)", aspectRatio: "1 / 1", position: "relative" }}>
                                <div className="syncly-feed-zoom">
                                    {item.image && (
                                        <img src={item.image} alt={item.title || ""}
                                            style={{
                                                width: "100%", height: "100%", objectFit: "cover", display: "block",
                                                filter: entered ? "blur(0px)" : `blur(${ENTER_BLUR}px)`,
                                                transition: `filter ${ENTER_TIME + 0.15}s ease-out ${delay}ms`,
                                            }} />
                                    )}
                                </div>
                                {item.tag && (
                                    <div style={{ position: "absolute", bottom: "10px", left: "10px", backgroundColor: "rgba(0,0,0,0.55)", color: "white", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 500, fontFamily: "Inter, sans-serif", backdropFilter: "blur(8px)" }}>
                                        {item.tag}
                                    </div>
                                )}
                            </div>
                            {item.title && (
                                <div style={{ marginTop: "8px", fontSize: "13px", fontWeight: 500, fontFamily: "Inter, sans-serif", color: "rgb(10,10,10)" }}>
                                    {item.title}
                                </div>
                            )}
                        </a>
                    )
                })}
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
function ProfessionalJourney({ isPhone, isTablet }: { isPhone: boolean; isTablet: boolean }) {
    const headingSize = isPhone ? 28 : isTablet ? 48 : 54
    const iconSize    = isPhone ? 18 : isTablet ? 32 : 41
    const iconGap     = isPhone ? 6  : isTablet ? 10 : 18
    const groupGap    = isPhone ? 14 : isTablet ? 20 : 20
    const outerPadTop = isPhone ? 60 : isTablet ? 60 : 80
    const sectionGap  = isPhone ? 24 : isTablet ? 28 : 40
    const cardsRadius = isPhone ? "18px" : "28px"
    const cardsGap    = isPhone ? 40 : isTablet ? 38 : 48
    const cardsPad    = isPhone ? "24px 16px" : isTablet ? "28px 28px" : "28px 38px"
    const cardsMaxW   = isPhone ? "343px" : "920px"
    const v = isPhone ? VARIANTS.phone : isTablet ? VARIANTS.tablet : VARIANTS.desktop

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${sectionGap}px`, paddingTop: `${outerPadTop}px`, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: `${groupGap}px` }}>
                <div style={{ display: "flex", gap: `${iconGap}px`, alignItems: "center" }}>
                    <img src={ICONS[0]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                    <img src={ICONS[1]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                </div>
                <span style={{ fontSize: `${headingSize}px`, fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Rounded', 'SF Pro Display', sans-serif", color: "rgb(10, 10, 10)", letterSpacing: "-0.03em", lineHeight: 1.1, whiteSpace: isPhone ? "normal" : "nowrap", textAlign: "center" }}>
                    Professional journey
                </span>
                <div style={{ display: "flex", gap: `${iconGap}px`, alignItems: "center" }}>
                    <img src={ICONS[2]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                    <img src={ICONS[3]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                </div>
            </div>
            <div style={{ width: "100%", maxWidth: cardsMaxW, backgroundColor: "rgb(250, 250, 250)", borderRadius: cardsRadius, overflow: "hidden", display: "flex", flexDirection: "column", gap: `${cardsGap}px`, padding: cardsPad, boxSizing: "border-box", margin: "0 auto" }}>
                <VendyWork     variant={v.vendy}     style={{ width: "100%" }} />
                <AcedboardWork variant={v.acedboard} style={{ width: "100%" }} />
                <KoectinWork   variant={v.koectin}   style={{ width: "100%" }} />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT CARD
// ─────────────────────────────────────────────────────────────────────────────
function ProjectCard({ image, title, description, tags, link }: { image: string; title: string; description: string; tags: string; link: string }) {
    return (
        <a href={link || undefined} target={link ? "_blank" : undefined} rel="noreferrer" style={{ textDecoration: "none", display: "block", width: "100%" }}>
            <div style={{ borderRadius: "24px", overflow: "hidden", backgroundColor: "rgb(250,250,250)", width: "100%" }}>
                <div style={{ width: "100%", aspectRatio: "16 / 9", overflow: "hidden", backgroundColor: "rgb(237,237,237)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {image
                        ? <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <span style={{ color: "rgba(0,0,0,0.3)", fontFamily: "Inter, sans-serif", fontSize: "14px" }}>Add project image →</span>
                    }
                </div>
                <div style={{ padding: "32px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "rgb(10,10,10)", letterSpacing: "-0.03em", marginBottom: "10px" }}>{title || "Project title"}</div>
                    <div style={{ fontSize: "15px", color: "rgba(10,10,10,0.55)", lineHeight: 1.6, marginBottom: "24px", fontFamily: "Inter, sans-serif" }}>{description || "Add a short project description."}</div>
                    {tags && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {tags.split(",").map((tag, i) => (
                                <span key={i} style={{ padding: "6px 14px", borderRadius: "999px", backgroundColor: "rgb(237,237,237)", fontSize: "13px", fontWeight: 500, fontFamily: "Inter, sans-serif", color: "rgb(80,80,80)" }}>{tag.trim()}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </a>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TabSection(props: TabSectionProps) {
    const {
        feedItems,
        projectTitle       = "Syncly",
        projectDescription = "A playlist migration tool that transfers playlists between Spotify, Apple Music and YouTube Music.",
        projectTags        = "Product Design, Development",
        projectImage       = "",
        projectLink        = "",
        activeFontWeight   = 600,
        inactiveFontWeight = 500,
        activeTextColor    = "rgb(10, 10, 10)",
        inactiveTextColor  = "rgb(163, 163, 163)",
        containerColor     = "rgb(235, 235, 235)",
        activeTabColor     = "rgb(255, 255, 255)",
        fontSize           = 16,
    } = props

    // Use panel items if any have been added, otherwise fall back to defaults
    const resolvedFeedItems = feedItems && feedItems.length > 0 ? feedItems : DEFAULT_FEED_ITEMS

    // activeTab drives the pill instantly; displayedTab swaps after fade-out
    const [activeTab, setActiveTab]       = useState<Tab>("Feed")
    const [displayedTab, setDisplayedTab] = useState<Tab>("Feed")
    const [fadingOut, setFadingOut]       = useState(false)
    const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const entered = useEntered([displayedTab])

    useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current) }, [])

    const windowWidth = useWindowWidth()

    const isPhone  = windowWidth <= BP_PHONE
    const isTablet = windowWidth > BP_PHONE && windowWidth <= BP_TABLET

    // ── Sticky detection ────────────────────────────────────────────────────
    const sentinelRef = useRef<HTMLDivElement>(null)
    const sectionRef  = useRef<HTMLDivElement>(null)
    const [isStuck, setIsStuck] = useState(false)

    useEffect(() => {
        if (isPhone) { setIsStuck(false); return }
        const sentinel = sentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            ([entry]) => setIsStuck(!entry.isIntersecting),
            { rootMargin: `-${TAB_STICKY_TOP}px 0px 0px 0px`, threshold: 0 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [isPhone])

    // ── Responsive tokens ───────────────────────────────────────────────────
    const tabFontSize = isPhone ? 13 : isTablet ? 15 : fontSize
    const tabPadding  = isPhone ? "8px 14px" : isTablet ? "11px 22px" : "13px 28px"
    const tabBarWidth = isPhone ? "min(calc(100% - 100px), 280px)" : isTablet ? "340px" : "360px"
    const contentPadH = isPhone ? "16px" : isTablet ? "48px" : "109px"
    const feedCols    = isPhone ? FEED_COLS_PHONE : isTablet ? FEED_COLS_TABLET : FEED_COLS_DESKTOP
    const feedGap     = isPhone ? 8 : isTablet ? 14 : 16
    const cardGap     = isPhone ? "20px" : "42px"
    const pillPad     = isPhone ? 4 : 5

    const stuckBg     = "rgba(235, 235, 235, 0.72)"
    const stuckBlur   = "blur(20px) saturate(180%)"
    const stuckShadow = "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 0.5px rgba(255,255,255,0.6)"

    // ── Tab change — fade out, swap content, scroll to section top ──────────
    const handleTabChange = (tab: Tab) => {
        if (tab === activeTab) return
        setActiveTab(tab)
        window.dispatchEvent(new CustomEvent("syncly:tabChange", { detail: tab }))
        if (sectionRef.current) {
            const top = sectionRef.current.getBoundingClientRect().top + window.scrollY
            window.scrollTo({ top, behavior: "smooth" })
        }
        setFadingOut(true)
        if (swapTimer.current) clearTimeout(swapTimer.current)
        swapTimer.current = setTimeout(() => {
            setDisplayedTab(tab)
            setFadingOut(false)
        }, TAB_OUT_MS)
    }

    const TABS: Tab[] = ["Feed", "Work", "Projects"]
    const activeIndex = TABS.indexOf(activeTab)

    // Non-feed content animates as one block (cards have their own internals)
    const blockEnter = {
        opacity: entered && !fadingOut ? 1 : 0,
        transform: entered && !fadingOut ? "none" : `translateY(${ENTER_RISE}px)`,
        transition: `opacity ${fadingOut ? TAB_OUT_MS / 1000 : ENTER_TIME}s ${EASING}, transform ${fadingOut ? TAB_OUT_MS / 1000 : ENTER_TIME}s ${EASING}`,
        willChange: "opacity, transform",
    } as const

    return (
        <div ref={sectionRef} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "48px", padding: "40px 0px 80px 0px" }}>

            <div ref={sentinelRef} style={{ height: 0, width: "100%", pointerEvents: "none" }} />

            {/* ── Tab bar ──────────────────────────────────────────────── */}
            <div style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                position: isPhone ? "static" : "sticky",
                top: isPhone ? undefined : `${TAB_STICKY_TOP}px`,
                zIndex: 50,
            }}>
                <div style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    backgroundColor: isStuck && !isPhone ? stuckBg : containerColor,
                    backdropFilter: isStuck && !isPhone ? stuckBlur : "none",
                    WebkitBackdropFilter: isStuck && !isPhone ? stuckBlur : "none",
                    borderRadius: "999px",
                    padding: `${pillPad}px`,
                    width: tabBarWidth,
                    boxShadow: isStuck && !isPhone ? stuckShadow : "none",
                    transition: `background-color 0.35s ${EASING}, box-shadow 0.35s ${EASING}`,
                    willChange: "background-color, box-shadow",
                }}>
                    {/* Sliding pill indicator — one element gliding between tabs */}
                    <div style={{
                        position: "absolute",
                        top: `${pillPad}px`,
                        bottom: `${pillPad}px`,
                        left: `${pillPad}px`,
                        width: `calc((100% - ${pillPad * 2}px) / ${TABS.length})`,
                        backgroundColor: activeTabColor,
                        borderRadius: "999px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
                        transform: `translateX(${activeIndex * 100}%)`,
                        transition: `transform 0.45s ${PILL_EASING}`,
                        willChange: "transform",
                        pointerEvents: "none",
                    }} />
                    {TABS.map((tab) => {
                        const active = tab === activeTab
                        return (
                            <button key={tab} onClick={() => handleTabChange(tab)} style={{ position: "relative", zIndex: 1, flex: 1, padding: tabPadding, borderRadius: "999px", border: "none", cursor: "pointer", fontSize: `${tabFontSize}px`, fontWeight: active ? activeFontWeight : inactiveFontWeight, fontFamily: "-apple-system, 'SF Pro Rounded', sans-serif", color: active ? activeTextColor : inactiveTextColor, backgroundColor: "transparent", transition: `color 0.25s ${EASING}`, whiteSpace: "nowrap", outline: "none", letterSpacing: "-0.01em" }}>
                                {tab}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Tab content ──────────────────────────────────────────── */}
            <div style={{ width: "100%", padding: `0 ${contentPadH}`, boxSizing: "border-box" }}>

                {displayedTab === "Feed" && (
                    <div style={{ opacity: fadingOut ? 0 : 1, transition: `opacity ${TAB_OUT_MS / 1000}s ${EASING}` }}>
                        <FeedGrid items={resolvedFeedItems} columns={feedCols} gap={feedGap} entered={entered && !fadingOut} />
                    </div>
                )}

                {displayedTab === "Work" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: cardGap, width: "100%", ...blockEnter }}>
                        {isPhone ? (
                            <>
                                <VendyMobile     style={{ width: "100%" }} />
                                <SmartcartMobile style={{ width: "100%" }} />
                                <CarpoolMobile   style={{ width: "100%" }} />
                                <ShopeaseMobile  style={{ width: "100%" }} />
                                <LeYouMobile     style={{ width: "100%" }} />
                            </>
                        ) : (
                            <>
                                <VendyDesktop     style={{ width: "100%" }} />
                                <SmartcartDesktop style={{ width: "100%" }} />
                                <CarpoolDesktop   style={{ width: "100%" }} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: cardGap }}>
                                    <ShopeaseDesktop style={{ width: "100%" }} />
                                    <LeYouDesktop    style={{ width: "100%" }} />
                                </div>
                            </>
                        )}
                        <ProfessionalJourney isPhone={isPhone} isTablet={isTablet} />
                    </div>
                )}

                {displayedTab === "Projects" && (
                    <div style={{ ...blockEnter }}>
                        <ProjectCard image={projectImage} title={projectTitle} description={projectDescription} tags={projectTags} link={projectLink} />
                    </div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTY CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
addPropertyControls(TabSection, {
    feedItems: {
        type: ControlType.Array,
        title: "Feed Items",
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.Image,  title: "Image" },
                title: { type: ControlType.String, title: "Title", defaultValue: "" },
                tag:   { type: ControlType.String, title: "Tag",   defaultValue: "" },
                link:  { type: ControlType.Link,   title: "Link" },
            },
        },
    },
    projectTitle:       { type: ControlType.String, title: "Project Title",       defaultValue: "Syncly" },
    projectDescription: { type: ControlType.String, title: "Project Description", defaultValue: "A playlist migration tool." },
    projectTags:        { type: ControlType.String, title: "Tags (comma-sep)",    defaultValue: "Product Design, Development" },
    projectImage:       { type: ControlType.Image,  title: "Project Image" },
    projectLink:        { type: ControlType.Link,   title: "Project Link" },
    fontSize: { type: ControlType.Number, title: "Tab Font Size (desktop)", defaultValue: 16, min: 10, max: 24, step: 1, displayStepper: true },
    activeFontWeight:   { type: ControlType.Enum, title: "Active Weight",   defaultValue: 600, options: [300, 400, 500, 600, 700, 800], optionTitles: ["Light", "Regular", "Medium", "Semibold", "Bold", "Extrabold"] },
    inactiveFontWeight: { type: ControlType.Enum, title: "Inactive Weight", defaultValue: 500, options: [300, 400, 500, 600, 700, 800], optionTitles: ["Light", "Regular", "Medium", "Semibold", "Bold", "Extrabold"] },
    activeTextColor:    { type: ControlType.Color, title: "Active Text",    defaultValue: "rgb(10, 10, 10)" },
    inactiveTextColor:  { type: ControlType.Color, title: "Inactive Text",  defaultValue: "rgb(163, 163, 163)" },
    containerColor:     { type: ControlType.Color, title: "Tab Container",  defaultValue: "rgb(235, 235, 235)" },
    activeTabColor:     { type: ControlType.Color, title: "Active Tab",     defaultValue: "rgb(255, 255, 255)" },
})
