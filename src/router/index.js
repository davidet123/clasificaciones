import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import AlcanzaTuMeta from '@/views/AlcanzaTuMeta.vue'
import Copernico from '@/views/Copernico.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/alcanzatumeta',
      name: 'alcanzatumeta',
      component: AlcanzaTuMeta,
    },
    {
      path: '/copernico',
      name: 'copernico',
      component: Copernico,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/mapa',
      name: 'Mapa',
      component: () => import('../views/MapaCarrera.vue'),
    },
    {
      path: '/perfil',
      name: 'Perfil',
      component: () => import('../views/PerfilAltimetricoPage.vue'),
    },
    {
      path: '/replay',
      name: 'replay',
      component: () => import('../views/ReplayPage.vue'),
    },
    {
      path: '/config',
      name: 'ConfigCarrera',
      component: () => import('../views/ConfigCarrera.vue'),
    },
    
  ],
})

export default router
