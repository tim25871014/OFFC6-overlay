<script setup>
import { RouterLink } from 'vue-router'

const overlays = [
    { name: 'intro', label: 'Intro' },
    { name: 'actions', label: 'Actions' },
    { name: 'gameplay', label: 'Gameplay' },
    { name: 'winner', label: 'Winner' },
    { name: 'showcase', label: 'Showcase' },
    { name: 'score', label: 'Score（控制台）' },
    
]
</script>

<template>
    <div class="min-h-screen w-full bg-slate-900 text-slate-100 p-10">
        <h1 class="text-4xl font-bold mb-2">OFFC6 Overlays</h1>
        <p class="text-slate-400 mb-8">在 OBS browser source 使用對應的 <code>#/route</code> 網址。</p>
        <div class="grid grid-cols-2 gap-4 max-w-2xl">
            <RouterLink v-for="o in overlays" :key="o.name" :to="{ name: o.name }"
                class="block rounded-lg bg-slate-800 hover:bg-slate-700 px-6 py-5 text-2xl transition-colors">
                {{ o.label }}
                <span class="block text-sm text-slate-400 mt-1">#/{{ o.name }}</span>
            </RouterLink>
        </div>
    </div>
</template>
