<script setup>
import { reactive, ref, computed, watch } from 'vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import TeamHeader from '../components/TeamHeader.vue'
import ChatPanel from '../components/ChatPanel.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { useGameState } from '../composables/useGameState'
import { useChat } from '../composables/useChat'
import { dataPath } from '../lib/dataPath'

const cardNameToId = {
  發燒: 'D1',
  猴子: 'D2',
  緊繃: 'D3',
  勝利之舞: 'B1',
  拉進垃圾車: 'B2',
  '黃金的守護者 魔法之光的龍': 'B3',
}

const { mappools, currentStage, teamAvatar } = useConfig()
const { chat, update: updateChatMessages } = useChat()

const actionsVideo = dataPath('video/actions.mp4')

// Mutable pool (EX-add appends to its beatmaps); kept in sync with config + current stage.
const pool = ref({})
watch(
  [mappools, currentStage],
  () => {
    pool.value = mappools.value?.mappools?.find((p) => p.stage === currentStage.value) || {}
  },
  { immediate: true },
)

const bdInfo = reactive({ redBD: [], blueBD: [] })

const picksInfo = reactive({
  redBans: [],
  blueBans: [],
  redPicks: [],
  bluePicks: [],
  pickCount: 0,
  TBPicked: false,
  TBbgUrl: '',
})

const cardInfo = reactive({ Cards: [], RedStadiums: [], BlueStadiums: [], isTwoStadiums: false })

const teamInfo = reactive({
  RedTeamName: '', BlueTeamName: '',
  RedTeamHP: 0, BlueTeamHP: 0,
  RedTeamAvatar: '', BlueTeamAvatar: '',
  RedTeamHPPercent: 100, BlueTeamHPPercent: 100,
  MaxHP: 0, RedTeamATK: 0, BlueTeamATK: 0, showAtk: false,
})

const controlPanel = reactive({ chatMode: true })
const toggleChat = () => { controlPanel.chatMode = !controlPanel.chatMode }

// --- beatmap lookups derived from the pool ---
const beatmapMap = computed(() => {
  const beatmaps = Array.isArray(pool.value?.beatmaps) ? pool.value.beatmaps : []
  const nextMap = {}
  beatmaps.forEach((beatmap) => {
    if (!beatmap?.identifier) return
    nextMap[beatmap.identifier] = {
      identifier: beatmap.identifier,
      artist: beatmap.artist || '',
      title: beatmap.title || '',
      beatmapset_id: beatmap.beatmapset_id,
      bgUrl: beatmap.beatmapset_id
        ? `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`
        : '',
    }
  })
  return nextMap
})
const getBeatmap = (identifier) => beatmapMap.value?.[identifier] || null

// --- control panel ---
const mappoolButtons = computed(
  () => pool.value?.beatmaps?.map((b) => b.identifier).filter(Boolean) || [],
)
const stages = computed(() => mappools.value?.mappools?.map((p) => p.stage).filter(Boolean) || [])
const selectedStage = ref('')
const selectedBeatmapIndex = ref('')
const beatmapOptions = computed(() => {
  if (!selectedStage.value) return []
  const stagePool = mappools.value?.mappools?.find((p) => p.stage === selectedStage.value) || {}
  const beatmaps = Array.isArray(stagePool?.beatmaps) ? stagePool.beatmaps : []
  return beatmaps.map((beatmap, index) => ({
    label: beatmap.identifier || beatmap.title || `Map ${index + 1}`,
    beatmap,
  }))
})
watch(selectedStage, () => {
  selectedBeatmapIndex.value = ''
})

const resetExSelectors = () => {
  selectedStage.value = ''
  selectedBeatmapIndex.value = ''
}

const addExBeatmap = () => {
  const index = Number(selectedBeatmapIndex.value)
  const option = beatmapOptions.value?.[index]
  if (!option || !pool.value?.beatmaps) return
  const exCount = pool.value.beatmaps.filter((beatmap) => /^EX\d+$/i.test(beatmap.identifier)).length
  const newBeatmap = { ...option.beatmap, identifier: `EX${exCount + 1}` }
  pool.value.beatmaps = [...pool.value.beatmaps, newBeatmap]
  resetExSelectors()
}

const removeIdentifierFromLists = (identifier) => {
  picksInfo.redPicks = picksInfo.redPicks.filter((item) => item !== identifier)
  picksInfo.bluePicks = picksInfo.bluePicks.filter((item) => item !== identifier)
  picksInfo.redBans = picksInfo.redBans.filter((item) => item !== identifier)
  picksInfo.blueBans = picksInfo.blueBans.filter((item) => item !== identifier)
}

const handlePickAction = (event, identifier) => {
  if (event.button !== 0 && event.button !== 2) return
  const side = event.button === 0 ? 'red' : 'blue'
  removeIdentifierFromLists(identifier)
  if (event.ctrlKey) return

  const isBan = event.shiftKey
  if (side === 'red') {
    if (isBan) picksInfo.redBans = [...picksInfo.redBans, identifier]
    else picksInfo.redPicks = [...picksInfo.redPicks, identifier]
  } else {
    if (isBan) picksInfo.blueBans = [...picksInfo.blueBans, identifier]
    else picksInfo.bluePicks = [...picksInfo.bluePicks, identifier]
  }
  updateStadiumInfo()
}

const handleTBAction = (event) => {
  if (event.button !== 0 && event.button !== 2) return

  const beatmap = Array.isArray(pool.value?.beatmaps)
    ? pool.value.beatmaps.find((b) => b.identifier.includes('TB'))
    : null
  if (beatmap?.beatmapset_id) {
    picksInfo.TBbgUrl = `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`
  } else {
    picksInfo.TBbgUrl = ''
  }

  if (event.ctrlKey) return (picksInfo.TBPicked = false)
  else return (picksInfo.TBPicked = true)
}

// --- stadium ban helpers ---
const isBanSectionVisible = (stadium) => {
  if (stadium.banOrder === 0) return true
  const targetBans = stadium.banOrder === 1 ? stadium.firstBans : stadium.secondBans
  return targetBans[0] + targetBans[1] === ''
}
const thisSlotBanInfo = (stadium, num) =>
  stadium.banOrder === 1 ? stadium.firstBans[num] : stadium.secondBans[num]
const thisSlotBanDetail = (stadium, num) => {
  const identifier = thisSlotBanInfo(stadium, num)
  const beatmap = Array.isArray(pool.value?.beatmaps)
    ? pool.value.beatmaps.find((b) => b.identifier === identifier)
    : null
  if (!identifier || !beatmap) {
    return { identifier: '', bgUrl: '' }
  }
  return {
    identifier,
    bgUrl: beatmap?.beatmapset_id
      ? `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`
      : '',
  }
}

// --- socket ---
function generatePickSlots(tourneyMng) {
  const bo = tourneyMng?.bestOF || 9
  picksInfo.pickCount = Math.floor(bo / 2)
  cardInfo.isTwoStadiums = tourneyMng?.bestOF >= 13
}

function updateTeamInfo(tourneyMng) {
  teamInfo.RedTeamName = tourneyMng?.team?.left || 'Red Team'
  teamInfo.BlueTeamName = tourneyMng?.team?.right || 'Blue Team'
  teamInfo.showAtk = tourneyMng?.scoreVisible === true
  teamInfo.RedTeamAvatar = teamAvatar(teamInfo.RedTeamName)
  teamInfo.BlueTeamAvatar = teamAvatar(teamInfo.BlueTeamName)
}

useTosuSocket((data) => {
  updateTeamInfo(data.tourney)
  updateChatMessages(data.tourney, controlPanel.chatMode)
  generatePickSlots(data.tourney)
})

// --- localStorage game-state ---
function updateRefInfo(state) {
  const redTeam = state.gameStatus?.teams?.red || {}
  const blueTeam = state.gameStatus?.teams?.blue || {}
  teamInfo.RedTeamHP = redTeam.hp || 0
  teamInfo.BlueTeamHP = blueTeam.hp || 0
  teamInfo.RedTeamATK = redTeam.totalAtk || 0
  teamInfo.BlueTeamATK = blueTeam.totalAtk || 0
  teamInfo.MaxHP = Math.max(teamInfo.MaxHP, teamInfo.RedTeamHP, teamInfo.BlueTeamHP)
  teamInfo.RedTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.RedTeamHP / teamInfo.MaxHP) * 100 : 0
  teamInfo.BlueTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.BlueTeamHP / teamInfo.MaxHP) * 100 : 0
}

function updateBDInfo(state) {
  const redTeam = state.gameStatus?.teams?.red || {}
  const blueTeam = state.gameStatus?.teams?.blue || {}

  const toCardUrls = (team) => {
    const blessings = Array.isArray(team?.blessings) ? team.blessings : []
    const disasters = Array.isArray(team?.disasters) ? team.disasters : []
    return [...blessings, ...disasters]
      .map((name) => cardNameToId[name])
      .filter(Boolean)
      .map((id) => dataPath(`img/cards/${id}.png`))
  }

  bdInfo.redBD = toCardUrls(redTeam)
  bdInfo.blueBD = toCardUrls(blueTeam)
}

function updateStadiumInfo() {
  const nextEvents = Array.isArray(game.gameEvent) ? game.gameEvent : []
  const stadiumEvents = nextEvents.filter((item) => item?.type === 'stadium')

  let firstBan = 'S2'
  for (const item of stadiumEvents) {
    if (item?.card === 'S2') break
    firstBan = 'S1'
  }

  const build = (teamColor) =>
    stadiumEvents
      .filter((item) => item?.team === teamColor)
      .map((item) => ({
        id: item?.card || '',
        name: item?.cardName || '',
        description: item?.effect || '',
        imageUrl: dataPath(`img/cards/${item?.card || ''}.png`),
        banOrder:
          item?.card === 'S1' || item?.card === 'S2' ? (item?.card === firstBan ? 1 : 2) : 0,
        firstBans: [picksInfo.redBans[0] || '', picksInfo.blueBans[0] || ''],
        secondBans: [picksInfo.redBans[1] || '', picksInfo.blueBans[1] || ''],
      }))

  cardInfo.RedStadiums = build('red')
  cardInfo.BlueStadiums = build('blue')
}

function updateCardInfo() {
  const nextEvents = Array.isArray(game.gameEvent) ? game.gameEvent : []

  const playEvents = nextEvents.filter((item) => item?.type == 'play' || item?.type == 'round-win')

  const currentCount = cardInfo.Cards.length
  if (playEvents.length < currentCount) cardInfo.Cards = []

  const newEvents = playEvents.slice(currentCount)
  const newCards = newEvents.map((item) => ({
    team: item?.team || '',
    id: item?.card || '',
    name: item?.cardName || '',
    cardType: item?.cardType || '',
    type: item?.type || '',
    description: item.cardType == 'M' ? item?.effect : item?.trigger + '，' + item?.effect || '',
    isAutoHovered: true, // 新卡片預設為展開狀態
    imageUrl: dataPath(`img/cards/${item?.card}.png`),
    avatarUrl: item.team === 'red' ? teamInfo.RedTeamAvatar : teamInfo.BlueTeamAvatar,
    dmage: item?.damage || 0,
    winnerTeam: item?.winnerTeam || '',
  }))
  newCards.reverse()

  cardInfo.Cards.unshift(...newCards)

  const addedCount = newCards.length
  for (let i = 0; i < addedCount; i++) {
    const reactiveCard = cardInfo.Cards[i]
    setTimeout(() => {
      reactiveCard.isAutoHovered = false
    }, 10000) // 過幾秒後自動收起
  }

  for (let idx = 0; idx < cardInfo.Cards.length; idx++) {
    const card = cardInfo.Cards[idx]
    if (idx === 0) continue
    const prevCard = cardInfo.Cards[idx - 1]
    if (card.team === prevCard.team) card.avatarUrl = 'none'
  }
}

const game = useGameState((state) => {
  updateRefInfo(state)
  updateBDInfo(state)
  setTimeout(() => {
    updateCardInfo()
  }, 100)
  setTimeout(() => {
    updateStadiumInfo()
  }, 100)
})
</script>

<template>
  <div id="main" class="absolute h-[1080px] w-[1920px] text-white">
    <BackgroundVideo :src="actionsVideo" />

    <TeamHeader
      :stage="currentStage"
      :red="{
        name: teamInfo.RedTeamName,
        avatar: teamInfo.RedTeamAvatar,
        hp: teamInfo.RedTeamHP,
        hpPercent: teamInfo.RedTeamHPPercent,
      }"
      :blue="{
        name: teamInfo.BlueTeamName,
        avatar: teamInfo.BlueTeamAvatar,
        hp: teamInfo.BlueTeamHP,
        hpPercent: teamInfo.BlueTeamHPPercent,
      }"
    />

    <div id="content" class="h-[720px] w-full flex flex-row">
      <div id="bd-group" class="contents">
        <div
          id="red-bd"
          class="order-1 w-[121px] h-full flex flex-col items-center gap-[4px] p-5 relative top-[-45px] left-[10px]"
        >
          <img
            v-for="(card, idx) in bdInfo.redBD"
            :key="`red-bd-${idx}`"
            :src="card"
            class="border-[1px] border-red-950 animate-[pulse-60_3s_ease-in-out_infinite] w-[60px] h-[45px] rounded-[7px]"
          />
        </div>
        <div
          id="blue-bd"
          class="order-5 w-[121px] h-full flex flex-col items-center gap-[4px] p-5 relative top-[-45px] left-[-10px]"
        >
          <img
            v-for="(card, idx) in bdInfo.blueBD"
            :key="`blue-bd-${idx}`"
            :src="card"
            class="border-[1px] border-blue-950 animate-[pulse-60_3s_ease-in-out_infinite] w-[60px] h-[45px] rounded-[7px]"
          />
        </div>
      </div>
      <div id="picks-group" class="contents">
        <div
          v-for="team in [
            { id: 'red', order: 'order-2', align: 'items-start', innerAlign: '', picks: picksInfo.redPicks, color: 'from-[#600000]/60', bg: '' },
            { id: 'blue', order: 'order-4', align: 'items-end', innerAlign: 'items-end', picks: picksInfo.bluePicks, color: 'from-[#000090]/60', bg: '' },
          ]"
          :key="`${team.id}-picks`"
          :id="`${team.id}-picks`"
          :class="[team.order, 'w-[500px] h-[827px] translate-y-[-10px] flex flex-col', team.align]"
        >
          <div
            :class="['mt-2', team.margin, 'font-rog text-[26px] text-center w-[167px] h-[45px] bg-linear-to-b from-white/50 via-transparent to-transparent rounded-full']"
          >
            PICKS
          </div>
          <div :class="['flex flex-col gap-3 h-full w-full pb-4 pt-2', team.innerAlign]">
            <div
              v-for="idx in picksInfo.pickCount"
              :key="`${team.id}-slot-${idx}`"
              :class="['w-[445px] flex-1 rounded-[14px] relative overflow-hidden', team.bg]"
            >
              <div
                v-if="team.picks[idx - 1]"
                class="absolute inset-0 pick-reveal z-0"
                :style="{ backgroundImage: getBeatmap(team.picks[idx - 1])?.bgUrl ? `url(${getBeatmap(team.picks[idx - 1]).bgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }"
              ></div>
              <div
                v-if="team.picks[idx - 1]"
                :class="['absolute inset-0 bg-gradient-to-r via-transparent to-transparent z-0 pick-reveal', team.color]"
              ></div>
              <div
                class="absolute inset-0 rounded-[14px] border-2 border-white/80 pointer-events-none z-10 pick-reveal"
              ></div>
              <div
                class="relative h-full w-full flex flex-col justify-center z-20"
                :class="team.picks[idx - 1] ? 'pick-reveal' : ''"
              >
                <div
                  class="font-rog text-[42px] absolute top-[-5px] left-[20px] right-[20px] text-white truncate text-shadow-lg"
                >
                  {{ getBeatmap(team.picks[idx - 1])?.identifier || '' }}
                </div>
                <div
                  class="font-lexend-regular absolute bottom-[27px] left-[20px] right-[20px] text-[14px] text-white/80 truncate text-shadow-md"
                >
                  {{ getBeatmap(team.picks[idx - 1])?.artist || '' }}
                </div>
                <div
                  class="font-lexend-black absolute bottom-[7px] left-[20px] right-[20px] text-[18px] text-white/90 truncate text-shadow-md"
                >
                  {{ getBeatmap(team.picks[idx - 1])?.title || '' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="picksInfo.TBPicked"
          class="absolute z-50 top-[50%] transform -translate-y-[155px] h-[400px] w-full bg-gradient-to-r from-[#7ba4afbb] via-[#7ba4af20] to-[#7ba4afbb] bg-[size:400%_400%] animate-[gradient_5s_ease_infinite]"
        >
          <img
            :src="picksInfo.TBbgUrl"
            class="bg-cover bg-center h-full w-[900px] rounded-[30px] absolute left-[50%] transform -translate-x-1/2 bg-black pick-reveal"
          />
          <div
            class="h-full w-[900px] rounded-[30px] border-[10px] border-[#bccdd3] absolute left-[50%] transform -translate-x-1/2 bg-linear-175 from-transparent via-[#7ba4afa0] to-transparent pick-reveal flex items-center justify-center"
          >
            <p
              class="text-[#f2f5f6] animate-[pulse_2s_ease-in_3] font-rog text-[90px] transform translate-y-[-15%] [text-shadow:10px_0px_0px_#333333] [-webkit-box-reflect:below_-55px_linear-gradient(transparent,rgba(0,0,0,0.8))]"
            >
              tiebreaker
            </p>
          </div>
        </div>
      </div>
      <div id="cards" class="order-3 w-[678px] h-full pt-[27px] flex flex-col">
        <div
          id="stadium-outer"
          class="w-full flex justify-center items-center"
          :class="cardInfo.isTwoStadiums ? 'h-[163px]' : 'h-[87px]'"
        >
          <p class="w-[5%] -rotate-90 transform translate-y-[6px] font-rog">STA</p>
          <div id="stadium" class="w-[90%] h-full flex flex-row gap-[5px]">
            <div
              v-for="team in [
                { id: 'red', stadiums: cardInfo.RedStadiums },
                { id: 'blue', stadiums: cardInfo.BlueStadiums },
              ]"
              :key="`${team.id}-stadium`"
              :id="`${team.id}-stadium`"
              class="w-[50%] h-full flex flex-col gap-[5px] justify-center"
            >
              <div v-for="(stadium, idx) in team.stadiums" :key="`${team.id}-stadium-${idx}`">
                <div
                  v-if="isBanSectionVisible(stadium)"
                  class="flex bg-[#253220] border-[#d9ead3] border-[1px] rounded-[10px] items-center gap-2 h-[72px] w-full overflow-hidden"
                >
                  <img
                    v-if="stadium.id !== 'none'"
                    :src="stadium.imageUrl"
                    class="ml-[10px] mr-[3px] h-[60px] w-[80px] rounded-[15px]"
                  />
                  <div class="flex flex-col">
                    <div class="flex flex-row">
                      <div class="text-gray-100 text-[20px] leading-tight break-words font-rog">
                        {{ stadium.id }}
                      </div>
                      <div
                        class="w-max block font-tpsans-bold text-[16px] pl-3 transform translate-y-[2px]"
                      >
                        {{ stadium.name }}
                      </div>
                    </div>
                    <div
                      class="w-max max-w-[190px] text-[13px] leading-tight font-tpsans-light whitespace-normal line-clamp-2 min-h-[30px]"
                    >
                      {{ stadium.description }}
                    </div>
                  </div>
                </div>

                <div v-if="!isBanSectionVisible(stadium)" class="flex flex-row gap-[5px]">
                  <div
                    v-for="slot in [0, 1]"
                    :key="slot"
                    class="relative overflow-hidden h-[72px] w-[50%] border-[#d9ead3] border-[1px] rounded-[10px] px-[8px] flex flex-col"
                    :class="thisSlotBanInfo(stadium, slot) == '' ? '' : 'pick-reveal'"
                  >
                    <img
                      v-if="thisSlotBanDetail(stadium, slot).bgUrl !== ''"
                      :src="thisSlotBanDetail(stadium, slot).bgUrl"
                      class="absolute inset-0 w-full h-full object-cover z-0"
                      alt="ban background"
                    />

                    <div
                      :class="
                        slot == 0
                          ? 'absolute inset-0 bg-gradient-to-r from-[#600000]/80 to-[#600000]/40 z-0'
                          : 'absolute inset-0 bg-gradient-to-l from-[#000090]/80 to-[#000090]/40 z-0'
                      "
                    ></div>

                    <div class="relative z-10">
                      <p class="font-rog text-[20px] text-shadow-md">
                        {{ thisSlotBanInfo(stadium, slot) }}
                      </p>
                      <p
                        class="font-rog text-[13px] text-shadow-md"
                        :class="thisSlotBanInfo(stadium, slot) == '' ? 'mt-[5px]' : 'mt-[-5px]'"
                      >
                        {{ thisSlotBanInfo(stadium, slot) == '' ? 'banning...' : 'banned' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="w-[5%] rotate-90 transform translate-y-[-6px] font-rog">STA</p>
        </div>
        <div id="card-play-outer" class="w-full flex-1 relative">
          <div
            class="inset-[5px] absolute top-2 bottom-2 left-0 right-0 rounded-[20px] border-[3px] border-[#7ba4af] bg-[#f6ffce]/10"
          >
            <p class="font-rog text-[22px] text-center">▲ cards ▲</p>
            <div
              id="card-play"
              class="flex h-[calc(100%-47px)] flex-col-reverse overflow-hidden text-[16px] text-white gap-[5px]"
            >
              <div v-for="(card, idx) in cardInfo.Cards" :key="`card-${idx}`">
                <div
                  v-if="card.type === 'play'"
                  class="flex flex-none gap-2 h-[72px] overflow-hidden"
                  :class="card.team == 'red' ? 'flex-row' : 'flex-row-reverse'"
                >
                  <div
                    id="card-avatar"
                    class="h-full w-[66px] flex"
                    :class="card.team === 'red' ? 'items-end justify-end' : 'items-end justify-start'"
                  >
                    <img
                      v-if="card.avatarUrl !== 'none'"
                      :src="card.avatarUrl"
                      class="h-[50px] w-[50px] rounded-full"
                    />
                  </div>

                  <div
                    id="card-info"
                    :class="[
                      'group rounded-[10px] w-fit max-w-[410px] flex items-center overflow-hidden transition-all duration-300 ease-out',
                      card.cardType === 'M' ? 'bg-[#21303d] border-[#cfe2f3] border-[1px]' : 'bg-[#3f252d] border-[#ffdde7] border-[1px]',
                      card.team === 'red' ? 'flex-row' : 'flex-row-reverse',
                    ]"
                  >
                    <img
                      id="card-image"
                      :src="card.imageUrl"
                      class="mx-[10px] h-[60px] w-[80px] flex-none rounded-[15px] bg-lime-400"
                    />

                    <div
                      id="card-description"
                      :class="['py-2 flex flex-col justify-center', card.team === 'red' ? 'mr-[20px]' : 'ml-[20px]']"
                    >
                      <div class="flex items-baseline">
                        <span class="text-gray-100 text-[20px] leading-tight break-words font-rog">
                          {{ card.id }}
                        </span>

                        <div
                          class="grid transition-all duration-300 ease-out"
                          :class="card.isAutoHovered ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0 group-hover:grid-cols-[1fr] group-hover:opacity-100'"
                        >
                          <div class="overflow-hidden">
                            <span
                              class="w-max block font-tpsans-bold text-[16px] pl-3 transform translate-y-[-1px]"
                            >
                              {{ card.name }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="flex flex-col">
                        <div
                          class="grid transition-all duration-300 ease-out"
                          :class="card.isAutoHovered ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100 group-hover:grid-rows-[0fr] group-hover:opacity-0'"
                        >
                          <div class="overflow-hidden">
                            <span class="font-tpsans-bold text-[16px] whitespace-nowrap block mt-[2px]">
                              {{ card.name }}
                            </span>
                          </div>
                        </div>

                        <div
                          class="grid transition-all duration-300 ease-out"
                          :class="card.isAutoHovered
                            ? 'grid-rows-[1fr] grid-cols-[1fr] opacity-100'
                            : 'grid-rows-[0fr] grid-cols-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:grid-cols-[1fr] group-hover:opacity-100'"
                        >
                          <div class="overflow-hidden">
                            <div
                              class="w-max max-w-[260px] text-[13px] leading-tight font-tpsans-light whitespace-normal line-clamp-2 min-h-[30px]"
                            >
                              {{ card.description }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="h-[72px] flex items-center justify-center">
                  <div
                    class="pick-reveal w-full h-[48px] flex flex-none font-rog text-[18px] items-center justify-center gap-2"
                    :class="card.winnerTeam === 'red' ? 'bg-gradient-to-r from-transparent from-[20%] via-[#600000]/80 to-transparent to-[80%] text-red-200' : 'bg-gradient-to-r from-transparent from-[20%] via-[#000090]/80 to-transparent to-[80%] text-blue-200'"
                  >
                    <span>{{ card.winnerTeam === 'red' ? '紅隊' : '藍隊' }}獲勝！</span>
                    <span class="text-gray-300">造成</span>
                    <span class="text-gray-200 text-[23px]">{{ card.dmage }}</span>
                    <span class="text-gray-300">點傷害</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="footer" class="relative bottom-0 flex h-[204px] w-full px-[20px]">
      <div id="chat" class="absolute top-0 left-[50%] transform -translate-x-1/2 h-full w-[678px]">
        <ChatPanel :messages="chat.messages" :show="chat.showChat" />
      </div>
    </div>
  </div>

  <div id="control-panel" class="absolute left-[1950px] flex gap-3 m-4 text-white flex-col">
    <button class="bg-black size-25" @click="toggleChat">Force Chat: {{ controlPanel.chatMode }}</button>
    <div
      id="mappool"
      class="text-black font-lexend-regular grid grid-flow-col auto-cols-max grid-rows-10 gap-2"
    >
      <div v-for="(identifier, idx) in mappoolButtons" :key="`mappool-${idx}`">
        <button
          v-if="identifier !== 'TB'"
          class="text-black rounded px-2 py-1 text-[20px] w-[60px] text-center"
          :class="
            identifier.includes('NM') ? 'bg-blue-300' :
            identifier.includes('HD') ? 'bg-yellow-300' :
            identifier.includes('HR') ? 'bg-red-300' :
            identifier.includes('DT') ? 'bg-purple-300' :
            identifier.includes('FM') ? 'bg-teal-300' :
            identifier.includes('HP') ? 'bg-green-300' : 'bg-gray-300'
          "
          @pointerdown.prevent="handlePickAction($event, identifier)"
          @contextmenu.prevent
        >
          {{ identifier }}
        </button>
        <button
          v-if="identifier === 'TB'"
          class="text-black rounded px-2 py-1 text-[20px] w-[60px] text-center bg-pink-300"
          @pointerdown.prevent="handleTBAction($event)"
          @contextmenu.prevent
        >
          TB
        </button>
      </div>
    </div>
    <div id="ex-selector" class="text-black font-lexend-regular flex flex-col gap-2 items-start">
      <p class="text-center font-lexend-black text-[20px] mt-4">EX maps</p>
      <select v-model="selectedStage" class="bg-white text-black rounded px-2 py-1 text-[20px]">
        <option value="" disabled>select stage</option>
        <option v-for="(stage, idx) in stages" :key="`stage-${idx}`" :value="stage">{{ stage }}</option>
      </select>
      <div v-if="selectedStage" class="flex flex-col gap-2">
        <select v-model="selectedBeatmapIndex" class="bg-white text-black rounded px-2 py-1 text-[20px]">
          <option value="" disabled>select map</option>
          <option v-for="(beatmap, idx) in beatmapOptions" :key="`beatmap-${idx}`" :value="idx">
            {{ beatmap.label }}
          </option>
        </select>
        <button
          v-if="selectedBeatmapIndex !== ''"
          class="bg-amber-300 text-black rounded px-2 py-1 text-[20px]"
          @click="addExBeatmap"
        >
          Add EX
        </button>
      </div>
    </div>
  </div>
</template>
