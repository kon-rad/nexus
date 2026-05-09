"use client";

import type { ReactNode } from "react";

export type TabItem<TKey extends string = string> = {
  key: TKey;
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

type TabBarProps<TKey extends string = string> = {
  items: ReadonlyArray<TabItem<TKey>>;
  activeKey: TKey;
  onChange: (key: TKey) => void;
};

/**
 * Flat tabbar with 2px cyan bottom border on active. See `.tabbar` / `.tab` in globals.css.
 */
export function TabBar<TKey extends string = string>({
  items,
  activeKey,
  onChange,
}: TabBarProps<TKey>) {
  return (
    <div className="tabbar" style={{ height: "100%" }}>
      {items.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`tab ${active ? "active" : ""}`}
          >
            {t.icon ? <span className="tab-icon">{t.icon}</span> : null}
            <span>{t.label}</span>
            {t.trailing}
          </button>
        );
      })}
    </div>
  );
}
