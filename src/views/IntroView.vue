<script setup>
import { reactive, ref } from 'vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import PlayerList from '../components/PlayerList.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { dataPath } from '../lib/dataPath'

const { teams: teamConfig, teamAvatar } = useConfig()

const introVideo = dataPath('video/intro.mp4')

const teams = reactive({ blue: '', red: '' })
const avatar = reactive({ blue: '', red: '' })
const redPlayers = ref([])
const bluePlayers = ref([])
const lobbyReady = ref(false)

function updateTeamInfo(tourneyMng) {
  teams.red = tourneyMng?.team?.left || ''
  teams.blue = tourneyMng?.team?.right || ''
  avatar.red = teamAvatar(teams.red)
  avatar.blue = teamAvatar(teams.blue)
}

function updatePlayerInfo() {
  const redTeam = teamConfig.value.find((t) => t.teamName === teams.red)?.players || []
  const blueTeam = teamConfig.value.find((t) => t.teamName === teams.blue)?.players || []
  redTeam.forEach((player) => {
    player.avatarUrl = `https://a.ppy.sh/${player.id}`
  })
  blueTeam.forEach((player) => {
    player.avatarUrl = `https://a.ppy.sh/${player.id}`
  })
  redPlayers.value = redTeam
  bluePlayers.value = blueTeam
}

// lobbyReady when both team names exist in teams.json
function checkLobbyReady() {
  const redTeamExists = teamConfig.value.some((t) => t.teamName === teams.red)
  const blueTeamExists = teamConfig.value.some((t) => t.teamName === teams.blue)
  lobbyReady.value = redTeamExists && blueTeamExists
}

useTosuSocket((data) => {
  updateTeamInfo(data.tourney)
  updatePlayerInfo()
  checkLobbyReady()
})
</script>

<template>
  <div class="absolute h-[1080px] w-[1920px]">
    <BackgroundVideo :src="introVideo" />
  </div>
  <div id="main" class="absolute h-[1080px] w-[1920px] text-white">
    <div id="header" class="h-[350px] w-full"></div>
    <div id="content" v-show="lobbyReady" class="pick-reveal h-[600px] w-full flex gap-15">
      <div
        v-for="side in ['red', 'blue']"
        :key="side"
        class="h-auto w-[50%] flex flex-col"
        :class="side === 'red' ? 'items-end' : 'items-start'"
      >
        <div class="flex mb-10 items-center" :class="side === 'red' ? '' : 'flex-row-reverse'">
          <div class="font-rog text-[50px] mx-10">{{ teams[side] }}</div>
          <div
            :style="{ backgroundImage: `url(${avatar[side]})` }"
            class="w-[160px] h-[120px] rounded-[10px] bg-cover bg-center"
          ></div>
        </div>
        <div class="space-y-1">
          <PlayerList
            :players="side === 'red' ? redPlayers : bluePlayers"
            variant="intro"
            :reverse="side === 'red'"
          />
        </div>
      </div>
    </div>
    <div id="loading" v-show="!lobbyReady" class="h-[600px] w-full flex justify-center">
      <h1
        class="mt-20 loading-text font-rog text-[200px] leading-none select-none"
        data-text="loading..."
      >
        loading<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>
      </h1>
    </div>
  </div>
</template>

<style>
.loading-text {
  position: relative;
  display: inline-block;
  animation: loading-glow 5s ease-in-out infinite;
}

.loading-text::before,
.loading-text::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
}

.loading-text::before {
  color: #00ffff;
  clip-path: polygon(0 0, 100% 0, 100% 32%, 0 32%);
  animation: loading-glitch-top 5s infinite;
  opacity: 0;
}

.loading-text::after {
  color: #ff00ff;
  clip-path: polygon(0 68%, 100% 68%, 100% 100%, 0 100%);
  animation: loading-glitch-bottom 5s infinite;
  opacity: 0;
}

@keyframes loading-glow {
  0%,
  100% {
    filter: drop-shadow(0 0 8px #ff008066) drop-shadow(0 0 22px #ff008033);
  }
  20% {
    filter: drop-shadow(0 0 8px #ff800066) drop-shadow(0 0 22px #ff800033);
  }
  40% {
    filter: drop-shadow(0 0 8px #00ff8066) drop-shadow(0 0 22px #00ff8033);
  }
  60% {
    filter: drop-shadow(0 0 8px #00bfff66) drop-shadow(0 0 22px #00bfff33);
  }
  80% {
    filter: drop-shadow(0 0 8px #8000ff66) drop-shadow(0 0 22px #8000ff33);
  }
}

.loading-dots span {
  opacity: 0;
}

@keyframes dot1 {
  0%,
  6% {
    opacity: 0;
  }
  7%,
  100% {
    opacity: 1;
  }
}
@keyframes dot2 {
  0%,
  38% {
    opacity: 0;
  }
  39%,
  100% {
    opacity: 1;
  }
}
@keyframes dot3 {
  0%,
  71% {
    opacity: 0;
  }
  72%,
  100% {
    opacity: 1;
  }
}

.loading-dots span:nth-child(1) {
  animation: dot1 1.5s steps(1) infinite;
}
.loading-dots span:nth-child(2) {
  animation: dot2 1.5s steps(1) infinite;
}
.loading-dots span:nth-child(3) {
  animation: dot3 1.5s steps(1) infinite;
}

@keyframes loading-glitch-top {
  0%,
  100% {
    opacity: 0;
    transform: none;
  }
  2% {
    opacity: 0.6;
    transform: translateX(-5px);
  }
  3% {
    opacity: 0;
  }
  80% {
    opacity: 0;
    transform: none;
  }
  80.5% {
    opacity: 1;
    transform: translateX(-12px) skewX(-4deg);
  }
  81.5% {
    opacity: 0.9;
    transform: translateX(9px) skewX(3deg);
  }
  83% {
    opacity: 0;
  }
  86% {
    opacity: 0.7;
    transform: translateX(-7px);
  }
  86.8% {
    opacity: 0;
  }
  92% {
    opacity: 0.5;
    transform: translateX(5px);
  }
  92.5% {
    opacity: 0;
  }
}

@keyframes loading-glitch-bottom {
  0%,
  100% {
    opacity: 0;
    transform: none;
  }
  2% {
    opacity: 0.6;
    transform: translateX(5px);
  }
  3% {
    opacity: 0;
  }
  80% {
    opacity: 0;
    transform: none;
  }
  80.5% {
    opacity: 1;
    transform: translateX(12px) skewX(4deg);
  }
  81.5% {
    opacity: 0.9;
    transform: translateX(-9px) skewX(-3deg);
  }
  83% {
    opacity: 0;
  }
  86% {
    opacity: 0.7;
    transform: translateX(7px);
  }
  86.8% {
    opacity: 0;
  }
  92% {
    opacity: 0.5;
    transform: translateX(-5px);
  }
  92.5% {
    opacity: 0;
  }
}
</style>
