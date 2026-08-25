import { useState, useEffect, useCallback } from 'react'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isIOSSafari() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isWebkit = /WebKit/.test(ua)
  const isNotCriOS = !/CriOS/.test(ua)
  return isIOS && isWebkit && isNotCriOS
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

export default function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(true)
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasPushManager = 'PushManager' in window
    const hasSW = 'serviceWorker' in navigator

    if (hasPushManager && hasSW) {
      setIsSupported(true)
      if ('Notification' in window) {
        setPermission(Notification.permission)
      }
      checkSubscription()
    } else if (isIOSSafari() && !isStandalone()) {
      setNeedsHomeScreen(true)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (err) {
      console.error('Check subscription error:', err)
    } finally {
      setLoading(false)
    }
  }

  const subscribe = useCallback(async () => {
    if (!isSupported) return { success: false, error: 'Not supported' }

    try {
      let perm = permission
      if (perm !== 'granted') {
        const result = await Notification.requestPermission()
        setPermission(result)
        perm = result
      }

      if (perm !== 'granted') {
        return { success: false, error: 'Permission denied' }
      }

      const keyRes = await fetch('/api/push/vapid-public-key')
      const { publicKey } = await keyRes.json()
      if (!publicKey) return { success: false, error: 'VAPID key not configured' }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const subJson = subscription.toJSON()
      const apiRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subJson }),
      })

      if (!apiRes.ok) {
        await subscription.unsubscribe()
        return { success: false, error: 'Failed to save subscription' }
      }

      setIsSubscribed(true)
      return { success: true }
    } catch (err) {
      console.error('Subscribe error:', err)
      return { success: false, error: err.message }
    }
  }, [isSupported, permission])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        setIsSubscribed(false)
        return { success: true }
      }

      const endpoint = subscription.endpoint
      await subscription.unsubscribe()

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })

      setIsSubscribed(false)
      return { success: true }
    } catch (err) {
      console.error('Unsubscribe error:', err)
      return { success: false, error: err.message }
    }
  }, [])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    needsHomeScreen,
    subscribe,
    unsubscribe,
  }
}
