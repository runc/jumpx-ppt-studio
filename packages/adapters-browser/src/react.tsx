import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { SkillFileData } from '@jumpx/forge-assets'
import type { AppPorts } from '@jumpx/ports'
import { createBrowserPorts } from './browser-ports.js'
import { RECIPE_CHANGED_EVENT } from './recipe/constants.js'
import { loadActiveRecipeSkillBundle } from './recipe/store.js'

const PortsContext = createContext<AppPorts | null>(null)

export function PortsProvider({
  ports,
  children,
}: {
  ports?: AppPorts
  children: React.ReactNode
}) {
  const value = useMemo(() => ports ?? createBrowserPorts(), [ports])
  return <PortsContext.Provider value={value}>{children}</PortsContext.Provider>
}

export function usePorts(): AppPorts {
  const ctx = useContext(PortsContext)
  if (!ctx) throw new Error('usePorts 必须在 PortsProvider 内使用')
  return ctx
}

export function useActiveRecipeSkill(baseForge: Record<string, SkillFileData>) {
  const [bundle, setBundle] = useState<{
    skillFiles: Record<string, SkillFileData>
    skillsMount: string
    recipeId: string
    ready: boolean
  }>({
    skillFiles: baseForge,
    skillsMount: '/skills/ai-slide-producer',
    recipeId: 'default',
    ready: false,
  })

  const refresh = useCallback(async () => {
    const next = await loadActiveRecipeSkillBundle(baseForge)
    setBundle({ ...next, ready: true })
  }, [baseForge])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChange = () => void refresh()
    window.addEventListener(RECIPE_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(RECIPE_CHANGED_EVENT, onChange)
  }, [refresh])

  return { ...bundle, refresh }
}

export { RECIPE_CHANGED_EVENT }
