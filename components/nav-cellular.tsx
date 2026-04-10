"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavCellular({
  cellular,
}: {
  cellular: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const rawPathname = usePathname()
  const pathname = rawPathname.endsWith('/') && rawPathname !== '/' ? rawPathname.slice(0, -1) : rawPathname
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})

  const isPathActive = React.useCallback(
    (url: string) => pathname === url || pathname.startsWith(url + "/"),
    [pathname],
  )

  const isItemActive = React.useCallback(
    (item: { url: string; items?: { url: string }[] }) => {
      if (pathname === item.url) return true

      if (item.items?.length) {
        return item.items.some((subItem) => isPathActive(subItem.url))
      }

      return pathname.startsWith(item.url + "/")
    },
    [isPathActive, pathname],
  )

  React.useEffect(() => {
    const states: Record<string, boolean> = {}
    cellular.forEach((item) => {
      states[item.title] = isItemActive(item)
    })
    setOpenItems(states)
  }, [cellular, isItemActive])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Cellular
      </SidebarGroupLabel>
      <SidebarMenu>
        {cellular.map((item) => {
          const isParentOrChildActive = isItemActive(item)

          return (
          <Collapsible
            key={item.title}
            asChild
            open={openItems[item.title] ?? false}
            onOpenChange={(isOpen) => setOpenItems((prev) => ({ ...prev, [item.title]: isOpen }))}
          >
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isParentOrChildActive}>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubItemActive = isPathActive(subItem.url)
                        return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )})}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        )})}
      </SidebarMenu>
    </SidebarGroup>
  )
}
