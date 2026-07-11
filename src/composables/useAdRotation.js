import { ref, computed, onMounted, onUnmounted } from 'vue'
import { dataPath } from '../lib/dataPath'

// Loads the ad list from _data/img/ad/ad-list.json, preloads the images and
// rotates through them with a cross-fade. Returns the reactive state consumed by
// the template. Timers are started on mount and cleared on unmount.
export function useAdRotation({ interval = 20000, fadeDuration = 250 } = {}) {
  const adImages = ref([])
  const adIndex = ref(0)
  const currentAdUrl = ref('')
  const adOpacity = ref(1)
  const showAd = computed(() => adImages.value.length > 0)
  let adTimer = null
  let fadeTimer = null

  const setAd = (index) => {
    adIndex.value = index
    currentAdUrl.value = adImages.value[index] || ''
    adOpacity.value = 1
  }
  const clearTimers = () => {
    if (adTimer) clearInterval(adTimer)
    if (fadeTimer) clearTimeout(fadeTimer)
    adTimer = null
    fadeTimer = null
  }
  const swapAd = () => {
    if (!adImages.value.length) return setAd(0)
    adOpacity.value = 0
    if (fadeTimer) clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      setAd((adIndex.value + 1) % adImages.value.length)
    }, fadeDuration)
  }
  const startRotation = () => {
    clearTimers()
    if (!adImages.value.length) return setAd(0)
    setAd(adIndex.value)
    if (adImages.value.length > 1) adTimer = setInterval(swapAd, interval)
  }
  const preloadAds = (files) => {
    if (!Array.isArray(files) || files.length === 0) return Promise.resolve([])
    const urls = files.map((file) => dataPath('img/ad/' + file))
    return Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve(url)
            img.onerror = () => resolve(null)
            img.src = url
          }),
      ),
    ).then((results) => results.filter(Boolean))
  }

  onMounted(() => {
    fetch(dataPath('img/ad/ad-list.json'))
      .then((res) => res.json())
      .then(preloadAds)
      .then((validUrls) => {
        adImages.value = validUrls
        startRotation()
      })
      .catch(() => {
        adImages.value = []
        startRotation()
      })
  })
  onUnmounted(() => clearTimers())

  return { currentAdUrl, adOpacity, showAd }
}
