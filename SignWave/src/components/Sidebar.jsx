import { BookOpen, MessageSquareText, Hand } from "lucide-react";

const ITEMS = [
  { route: "learn", label: "Learning", icon: BookOpen },
  { route: "communicate", label: "Communication", icon: MessageSquareText },
];

export default function Sidebar({ route }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#/learn"><Hand size={22} aria-hidden="true" /> Sign Learn</a>
      <nav aria-label="Main">
        {ITEMS.map(({ route: r, label, icon: Icon }) => (
          <a key={r} href={`#/${r}`} className={route === r ? "nav active" : "nav"} aria-current={route === r ? "page" : undefined}>
            <Icon size={18} aria-hidden="true" /> {label}
          </a>
        ))}
      </nav>
      <p className="privacy">Camera frames are processed in your browser and never uploaded.</p>
    </aside>
  );
}
