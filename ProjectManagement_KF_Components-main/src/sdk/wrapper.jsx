import KFSDK from '@kissflow/lowcode-client-sdk'
import React, { useEffect, useState } from 'react'
import { KissflowSDKContext } from './context.jsx'

let kf

export function SDKWrapper(props) {
  const [kfInstance, setKfInstance] = useState(null)
  const [sdkFailed, setSdkFailed] = useState(false)

  useEffect(() => {
    if (window.kf) {
      kf = window.kf
      setKfInstance(window.kf)
      return
    }

    KFSDK.initialize()
      .then((sdk) => {
        window.kf = kf = sdk
        setKfInstance(sdk)
        setSdkFailed(false)
      })
      .catch((err) => {
        setSdkFailed(true)
        console.warn('SDK not available (preview mode):', err?.message || err)
      })
  }, [])

  return (
    <KissflowSDKContext.Provider value={{ kf: kfInstance, sdkReady: !!kfInstance }}>
      <>
        {sdkFailed && (
          <div style={{ padding: '8px 16px', background: '#fef3c7', color: '#92400e', fontSize: 12, textAlign: 'center' }}>
            Preview mode - connect in a Kissflow app for full integration.
          </div>
        )}
        {props.children}
      </>
    </KissflowSDKContext.Provider>
  )
}

export { kf }
