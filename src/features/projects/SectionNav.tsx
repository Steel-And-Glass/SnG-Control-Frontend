"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./ProjectDetail.module.css";

type Section = { id: string; label: string };

/**
 * Sticky index of the project page. It discovers the sections that are actually rendered for the active role
 * (elements with data-section and id) so it never lists a panel the person cannot see, and it does not hide or
 * move any panel.
 */
export function SectionNav() {
  const ref = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  useEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    let frame = 0;
    const scan = () => {
      const found = Array.from(root.querySelectorAll<HTMLElement>("[data-section][id]")).map(element => ({ id: element.id, label: element.dataset.section ?? "" }));
      setSections(previous => previous.length === found.length && previous.every((section, index) => section.id === found[index].id && section.label === found[index].label) ? previous : found);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(scan); };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  function go(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  return <nav ref={ref} className={styles.sectionNav} aria-label="Secciones del proyecto" hidden={sections.length < 2}>
    {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={event => go(event, section.id)}>{section.label}</a>)}
  </nav>;
}
