import {
  ActivityIcon,
  BarChart3Icon,
  BotIcon,
  CpuIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  NetworkIcon,
  UsersIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "Мониторинг",
    items: [
      { title: "Обзор", url: "/", icon: LayoutDashboardIcon },
      { title: "Интерфейсы", url: "/interfaces", icon: NetworkIcon },
      { title: "Клиенты", url: "/clients", icon: UsersIcon },
      { title: "Нагрузка", url: "/load", icon: BarChart3Icon },
    ],
  },
  {
    label: "Система",
    items: [
      { title: "События", url: "/events", icon: ActivityIcon },
      { title: "Устройство", url: "/device", icon: CpuIcon },
      { title: "ИИ-ассистент", url: "/assistant", icon: BotIcon },
      { title: "Терминал", url: "/terminal", icon: MonitorIcon },
    ],
  },
]

/** Flat list kept for places that don't need grouping. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)
