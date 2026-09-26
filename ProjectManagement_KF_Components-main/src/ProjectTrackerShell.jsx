import { useContext, useEffect, useMemo } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { AppRoutes } from './router/index.js'
import i18n from './i18n/index.js'
import { KissflowSDKContext } from './sdk/index.js'
import { ProjectTrackerEmbedContext } from './contexts/ProjectTrackerEmbedContext.jsx'

export default function ProjectTrackerShell({ initialRoute = '/dashboard' }) {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext)
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null)

  const safeInitialRoute = useMemo(
    () => (typeof initialRoute === 'string' && initialRoute.startsWith('/') ? initialRoute : '/dashboard'),
    [initialRoute],
  )

  useEffect(() => {
    if (!sdkReady || !kfInstance) return

    try {
      const user = kfInstance.user
      if (user?.Name) {
        console.info(`Kissflow user: ${user.Name}`)
      }
    } catch (error) {
      console.warn('Unable to read Kissflow user details', error)
    }
  }, [sdkReady, kfInstance])

  return (
    <I18nextProvider i18n={i18n}>
      <ProjectTrackerEmbedContext.Provider value={{ embed: true }}>
        <MemoryRouter initialEntries={[safeInitialRoute]}>
          <AppRoutes />
        </MemoryRouter>
      </ProjectTrackerEmbedContext.Provider>
    </I18nextProvider>
  )
}
