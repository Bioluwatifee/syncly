// ─────────────────────────────────────────────────────────────────────────────
// BACKUP — Gallery / Work / Projects (pre-Playground)
// To revert: push this file's content to Framer codeFileId: SJ7meDK
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

const BP_PHONE  = 480
const BP_TABLET = 810

const FEED_COLS_PHONE   = 2
const FEED_COLS_TABLET  = 3
const FEED_COLS_DESKTOP = 4

const TAB_STICKY_TOP       = 84
const TAB_STICKY_TOP_PHONE = 76

const EASING      = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
const PILL_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)"
const ENTER_RISE  = 18
const ENTER_TIME  = 0.55
const ENTER_BLUR  = 16
const STAGGER_MS  = 45
const STAGGER_CAP = 540
const TAB_OUT_MS  = 180
const HOVER_ZOOM  = 1.065

const GLASS_BAR_BG   = "linear-gradient(180deg, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0.14) 100%)"
const GLASS_BAR_BLUR = "blur(32px) saturate(220%)"

const GLASS_BAR_SHADOW = [
    "inset 0 1px 0 rgba(255,255,255,0.85)",
    "inset 0 -1px 0 rgba(255,255,255,0.25)",
    "0 0 0 0.75px rgba(0,0,0,0.05)",
    "0 4px 20px rgba(0,0,0,0.07)",
].join(", ")

const GLASS_BAR_SHADOW_STUCK = [
    "inset 0 1px 0 rgba(255,255,255,0.85)",
    "inset 0 -1px 0 rgba(255,255,255,0.25)",
    "0 0 0 0.75px rgba(0,0,0,0.05)",
    "0 8px 28px rgba(0,0,0,0.11)",
    "0 2px 6px rgba(0,0,0,0.05)",
].join(", ")

const GLASS_PILL_BG     = "linear-gradient(180deg, rgba(120,120,128,0.07) 0%, rgba(120,120,128,0.13) 100%)"
const GLASS_PILL_SHADOW = [
    "inset 0 1px 0 rgba(255,255,255,0.60)",
    "inset 0 0 0 0.5px rgba(255,255,255,0.35)",
    "0 1px 3px rgba(0,0,0,0.05)",
].join(", ")

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
// @ts-ignore
import SynclyWeb    from "https://framer.com/m/Syncly-web-pkOFc7.js"
// @ts-ignore
import SynclyTab    from "https://framer.com/m/Syncly-tab-tqZJsp.js"
// @ts-ignore
import SynclyMobile from "https://framer.com/m/syncly-mobile-pRSJbi.js"
// @ts-ignore
import VendyWork      from "https://framer.com/m/vendy-HnPztU.js"
// @ts-ignore
import AcedboardWork  from "https://framer.com/m/Acedboard-dHkChV.js"
// @ts-ignore
import KoectinWork    from "https://framer.com/m/Koectin-nZ4vdp.js"

const VARIANTS = {
    desktop: { vendy: "HDJQDXnG8", acedboard: "lXByPMKBy",  koectin: "OT0rBoYi9" },
    tablet:  { vendy: "ODNV7FVry", acedboard: "memv2WoOV",  koectin: "YHHVr4jtJ" },
    phone:   { vendy: "YZvsZZus8", acedboard: "wJru680mR",  koectin: "AdCJQPlKp" },
}

const ICONS = [
    "https://framerusercontent.com/images/JI97CqIqqvvn5llShDalXszt7y8.png",
    "https://framerusercontent.com/images/arYSfxPkLdDkqirztk55GmELD0.png",
    "https://framerusercontent.com/images/JHnf90iUMQ35lbiAz6u3SF7lg.png",
    "https://framerusercontent.com/images/7W0wXnWeU0MEJRhqUK0gJu4Y7r8.png",
]

type Tab = "Gallery" | "Work" | "Projects"
interface FeedItem { image: string; title: string; tag: string; link: string }
interface TabSectionProps {
    feedItems: FeedItem[]
    activeFontWeight: number
    inactiveFontWeight: number
    activeTextColor: string
    inactiveTextColor: string
    fontSize: number
}

function useWindowWidth() {
    const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1440)
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return width
}

function useEntered(deps: any[]) {
    const [entered, setEntered] = useState(false)
    useEffect(() => {
        setEntered(false)
        let raf2: number
        const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setEntered(true)) })
        return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
    }, deps)
    return entered
}

function FeedGrid({ items, columns, gap, entered }: { items: FeedItem[]; columns: number; gap: number; entered: boolean }) {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                .syncly-feed-zoom { width:100%; height:100%; transform:scale(1); transition:transform 0.45s ${EASING}; will-change:transform; }
                .syncly-feed-item:hover .syncly-feed-zoom { transform:scale(${HOVER_ZOOM}) !important; }
            ` }} />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px`, width: "100%" }}>
                {items.map((item, i) => {
                    const delay = Math.min(i * STAGGER_MS, STAGGER_CAP)
                    return (
                        <a key={i} href={item.link || undefined} target={item.link ? "_blank" : undefined} rel="noreferrer" className="syncly-feed-item"
                            style={{ textDecoration: "none", display: "block", cursor: "pointer", opacity: entered ? 1 : 0, transform: entered ? "none" : `translateY(${ENTER_RISE}px)`, transition: `opacity ${ENTER_TIME}s ${EASING} ${delay}ms, transform ${ENTER_TIME}s ${EASING} ${delay}ms`, willChange: "opacity, transform" }}>
                            <div style={{ borderRadius: "16px", overflow: "hidden", backgroundColor: "rgb(245,245,245)", aspectRatio: "1 / 1", position: "relative" }}>
                                <div className="syncly-feed-zoom">
                                    {item.image && <img src={item.image} alt={item.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: entered ? "blur(0px)" : `blur(${ENTER_BLUR}px)`, transition: `filter ${ENTER_TIME + 0.15}s ease-out ${delay}ms` }} />}
                                </div>
                                {item.tag && <div style={{ position: "absolute", bottom: "10px", left: "10px", backgroundColor: "rgba(0,0,0,0.55)", color: "white", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 500, fontFamily: "Inter, sans-serif", backdropFilter: "blur(8px)" }}>{item.tag}</div>}
                            </div>
                            {item.title && <div style={{ marginTop: "8px", fontSize: "13px", fontWeight: 500, fontFamily: "Inter, sans-serif", color: "rgb(10,10,10)" }}>{item.title}</div>}
                        </a>
                    )
                })}
            </div>
        </>
    )
}

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
                <span style={{ fontSize: `${headingSize}px`, fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Rounded', 'SF Pro Display', sans-serif", color: "rgb(10,10,10)", letterSpacing: "-0.03em", lineHeight: 1.1, whiteSpace: isPhone ? "normal" : "nowrap", textAlign: "center" }}>Professional journey</span>
                <div style={{ display: "flex", gap: `${iconGap}px`, alignItems: "center" }}>
                    <img src={ICONS[2]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                    <img src={ICONS[3]} alt="" style={{ width: iconSize, height: iconSize, display: "block", flexShrink: 0 }} />
                </div>
            </div>
            <div style={{ width: "100%", maxWidth: cardsMaxW, backgroundColor: "rgb(250,250,250)", borderRadius: cardsRadius, overflow: "hidden", display: "flex", flexDirection: "column", gap: `${cardsGap}px`, padding: cardsPad, boxSizing: "border-box", margin: "0 auto" }}>
                <VendyWork     variant={v.vendy}     style={{ width: "100%" }} />
                <AcedboardWork variant={v.acedboard} style={{ width: "100%" }} />
                <KoectinWork   variant={v.koectin}   style={{ width: "100%" }} />
            </div>
        </div>
    )
}

export default function TabSection(props: TabSectionProps) {
    const {
        feedItems,
        activeFontWeight   = 600,
        inactiveFontWeight = 500,
        activeTextColor    = "rgb(10, 10, 10)",
        inactiveTextColor  = "rgba(10, 10, 10, 0.42)",
        fontSize           = 16,
    } = props

    const resolvedFeedItems = feedItems && feedItems.length > 0 ? feedItems : DEFAULT_FEED_ITEMS
    const [activeTab, setActiveTab]       = useState<Tab>("Gallery")
    const [displayedTab, setDisplayedTab] = useState<Tab>("Gallery")
    const [fadingOut, setFadingOut]       = useState(false)
    const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const entered = useEntered([displayedTab])
    useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current) }, [])

    const windowWidth = useWindowWidth()
    const isPhone  = windowWidth <= BP_PHONE
    const isTablet = windowWidth > BP_PHONE && windowWidth <= BP_TABLET
    const stickyTop = isPhone ? TAB_STICKY_TOP_PHONE : TAB_STICKY_TOP

    const sentinelRef = useRef<HTMLDivElement>(null)
    const sectionRef  = useRef<HTMLDivElement>(null)
    const [isStuck, setIsStuck] = useState(false)

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            ([entry]) => setIsStuck(!entry.isIntersecting),
            { rootMargin: `-${stickyTop}px 0px 0px 0px`, threshold: 0 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [stickyTop])

    const tabFontSize = isPhone ? 13 : isTablet ? 15 : fontSize
    const tabPadding  = isPhone ? "8px 14px" : isTablet ? "11px 22px" : "13px 28px"
    const tabBarWidth = isPhone ? "min(calc(100% - 100px), 280px)" : isTablet ? "340px" : "360px"
    const contentPadH = isPhone ? "16px" : isTablet ? "48px" : "60px"
    const feedCols    = isPhone ? FEED_COLS_PHONE : isTablet ? FEED_COLS_TABLET : FEED_COLS_DESKTOP
    const feedGap     = isPhone ? 8 : isTablet ? 14 : 16
    const cardGap     = isPhone ? "20px" : "42px"
    const pillPad     = isPhone ? 4 : 5

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
        swapTimer.current = setTimeout(() => { setDisplayedTab(tab); setFadingOut(false) }, TAB_OUT_MS)
    }

    const TABS: Tab[] = ["Gallery", "Work", "Projects"]
    const activeIndex = TABS.indexOf(activeTab)

    const blockEnter = {
        opacity: entered && !fadingOut ? 1 : 0,
        transform: entered && !fadingOut ? "none" : `translateY(${ENTER_RISE}px)`,
        transition: `opacity ${fadingOut ? TAB_OUT_MS / 1000 : ENTER_TIME}s ${EASING}, transform ${fadingOut ? TAB_OUT_MS / 1000 : ENTER_TIME}s ${EASING}`,
        willChange: "opacity, transform",
    } as const

    return (
        <div ref={sectionRef} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "48px", padding: "40px 0px 80px 0px" }}>
            <style dangerouslySetInnerHTML={{ __html: `
                .syncly-tab-btn { -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
                .syncly-tab-btn:active { transform: scale(0.88) !important; transition: transform 0.08s ease-out !important; }
            ` }} />
            <div ref={sentinelRef} style={{ height: 0, width: "100%", pointerEvents: "none" }} />
            <div style={{ width: "100%", display: "flex", justifyContent: "center", position: "sticky", top: `${stickyTop}px`, zIndex: 50 }}>
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center", background: GLASS_BAR_BG, backdropFilter: GLASS_BAR_BLUR, WebkitBackdropFilter: GLASS_BAR_BLUR, borderRadius: "999px", padding: `${pillPad}px`, width: tabBarWidth, boxShadow: isStuck ? GLASS_BAR_SHADOW_STUCK : GLASS_BAR_SHADOW, transition: `box-shadow 0.35s ${EASING}`, willChange: "box-shadow" }}>
                    <div style={{ position: "absolute", top: `${pillPad}px`, bottom: `${pillPad}px`, left: `${pillPad}px`, width: `calc((100% - ${pillPad * 2}px) / ${TABS.length})`, background: GLASS_PILL_BG, borderRadius: "999px", boxShadow: GLASS_PILL_SHADOW, transform: `translateX(${activeIndex * 100}%)`, transition: `transform 0.5s ${PILL_EASING}`, willChange: "transform", pointerEvents: "none" }} />
                    {TABS.map((tab) => {
                        const active = tab === activeTab
                        return <button key={tab} className="syncly-tab-btn" onClick={() => handleTabChange(tab)} style={{ position: "relative", zIndex: 1, flex: 1, padding: tabPadding, borderRadius: "999px", border: "none", cursor: "pointer", fontSize: `${tabFontSize}px`, fontWeight: active ? activeFontWeight : inactiveFontWeight, fontFamily: "-apple-system, 'SF Pro Rounded', sans-serif", color: active ? activeTextColor : inactiveTextColor, backgroundColor: "transparent", transition: `color 0.22s ${EASING}, transform 0.18s ${PILL_EASING}`, whiteSpace: "nowrap", outline: "none", letterSpacing: "-0.01em" }}>{tab}</button>
                    })}
                </div>
            </div>
            <div style={{ width: "100%", padding: `0 ${contentPadH}`, boxSizing: "border-box" }}>
                {displayedTab === "Gallery" && (
                    <div style={{ opacity: fadingOut ? 0 : 1, transition: `opacity ${TAB_OUT_MS / 1000}s ${EASING}` }}>
                        <FeedGrid items={resolvedFeedItems} columns={feedCols} gap={feedGap} entered={entered && !fadingOut} />
                    </div>
                )}
                {displayedTab === "Work" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: cardGap, width: "100%", ...blockEnter }}>
                        {isPhone ? (
                            <><VendyMobile style={{ width: "100%" }} /><SmartcartMobile style={{ width: "100%" }} /><CarpoolMobile style={{ width: "100%" }} /><ShopeaseMobile style={{ width: "100%" }} /><LeYouMobile style={{ width: "100%" }} /></>
                        ) : (
                            <><VendyDesktop style={{ width: "100%" }} /><SmartcartDesktop style={{ width: "100%" }} /><CarpoolDesktop style={{ width: "100%" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: cardGap }}><ShopeaseDesktop style={{ width: "100%" }} /><LeYouDesktop style={{ width: "100%" }} /></div></>
                        )}
                        <ProfessionalJourney isPhone={isPhone} isTablet={isTablet} />
                    </div>
                )}
                {displayedTab === "Projects" && (
                    <div style={{ ...blockEnter }}>
                        {isPhone ? <SynclyMobile style={{ width: "100%" }} /> : isTablet ? <SynclyTab style={{ width: "100%" }} /> : <SynclyWeb style={{ width: "100%" }} />}
                    </div>
                )}
            </div>
        </div>
    )
}

addPropertyControls(TabSection, {
    feedItems: { type: ControlType.Array, title: "Gallery Items", control: { type: ControlType.Object, controls: { image: { type: ControlType.Image, title: "Image" }, title: { type: ControlType.String, title: "Title", defaultValue: "" }, tag: { type: ControlType.String, title: "Tag", defaultValue: "" }, link: { type: ControlType.Link, title: "Link" } } } },
    fontSize:           { type: ControlType.Number, title: "Tab Font Size (desktop)", defaultValue: 16, min: 10, max: 24, step: 1, displayStepper: true },
    activeFontWeight:   { type: ControlType.Enum,   title: "Active Weight",   defaultValue: 600, options: [300, 400, 500, 600, 700, 800], optionTitles: ["Light", "Regular", "Medium", "Semibold", "Bold", "Extrabold"] },
    inactiveFontWeight: { type: ControlType.Enum,   title: "Inactive Weight", defaultValue: 500, options: [300, 400, 500, 600, 700, 800], optionTitles: ["Light", "Regular", "Medium", "Semibold", "Bold", "Extrabold"] },
    activeTextColor:    { type: ControlType.Color,  title: "Active Text",    defaultValue: "rgb(10, 10, 10)" },
    inactiveTextColor:  { type: ControlType.Color,  title: "Inactive Text",  defaultValue: "rgba(10, 10, 10, 0.42)" },
})
