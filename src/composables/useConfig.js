import { ref, computed, onMounted } from 'vue'
import { dataPath } from '../lib/dataPath'

// Loads mappools.json + teams.json from _data/config and exposes the derived
// current stage / pool plus a team-avatar resolver. Shared by intro, actions,
// gameplay and winner.
export function useConfig() {
  const mappools = ref({})
  const teams = ref([])
  const ready = ref(false)

  const currentStage = computed(() => mappools.value?.current_stage || 'Unknown Stage')
  const pool = computed(
    () => mappools.value?.mappools?.find((p) => p.stage === currentStage.value) || {},
  )

  const teamAvatar = (teamName) => {
    const t = teams.value.find((team) => team.teamName === teamName)
    return dataPath('img/avatar/' + (t?.avatar || 'default.jpg'))
  }

  onMounted(async () => {
    try {
      mappools.value = await fetch(dataPath('config/mappools.json')).then((r) => r.json())
    } catch {
      mappools.value = {}
    }
    try {
      teams.value = await fetch(dataPath('config/teams.json')).then((r) => r.json())
    } catch {
      teams.value = []
    }
    ready.value = true
  })

  return { mappools, teams, currentStage, pool, teamAvatar, ready }
}
