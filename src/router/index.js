import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history: tosu's static file server does no SPA history fallback, so hash
// routing (#/gameplay, #/intro, ...) is what keeps each OBS browser source working.
const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/intro', name: 'intro', component: () => import('../views/IntroView.vue') },
  { path: '/actions', name: 'actions', component: () => import('../views/ActionsView.vue') },
  { path: '/gameplay', name: 'gameplay', component: () => import('../views/GameplayView.vue') },
  { path: '/score', name: 'score', component: () => import('../views/ScoreView.vue') },
  { path: '/winner', name: 'winner', component: () => import('../views/WinnerView.vue') },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
