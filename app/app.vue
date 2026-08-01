<script setup lang="ts">
const route = useRoute()
const { mobile } = useDisplay()
const { user, ready, refresh, logout } = useAuth()

if (!ready.value) await refresh()
useRealtime(computed(() => Boolean(user.value)))

const drawer = ref(!mobile.value)
const signingOut = ref(false)
const isAppPage = computed(() => Boolean(user.value) && route.path !== '/login')
const navigation = computed(() => [
  { title: 'Мои задачи', icon: 'mdi-check-circle-outline', to: '/' },
  { title: 'Проекты', icon: 'mdi-view-grid-outline', to: '/projects' },
  ...(user.value?.role !== 'member'
    ? [{ title: 'Управление', icon: 'mdi-shield-account-outline', to: '/admin' }]
    : []),
])

watch(mobile, value => drawer.value = !value)

async function signOut() {
  signingOut.value = true
  try {
    await logout()
    await navigateTo('/login')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <VApp>
    <template v-if="isAppPage">
      <VNavigationDrawer
        v-model="drawer"
        :permanent="!mobile"
        width="272"
        class="app-drawer"
      >
        <div class="brand-block pa-5">
          <VAvatar color="primary" size="44" rounded="lg" class="brand-mark">Л</VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold">Задачи Линки</div>
            <div class="text-caption text-medium-emphasis">Рабочее пространство</div>
          </div>
        </div>
        <VList nav density="comfortable" class="px-3">
          <VListItem
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            rounded="lg"
            color="primary"
            @click="mobile && (drawer = false)"
          />
        </VList>
        <template #append>
          <VDivider />
          <VListItem class="ma-3" rounded="lg" :subtitle="user ? `@${user.username}` : ''">
            <template #prepend>
              <VAvatar color="primary" size="38">{{ initials(user?.displayName || user?.username || '') }}</VAvatar>
            </template>
            <template #title>
              <span class="text-body-2 font-weight-medium">{{ user?.displayName || user?.username }}</span>
            </template>
            <template #append>
              <VBtn
                icon="mdi-logout"
                size="small"
                variant="text"
                aria-label="Выйти"
                :loading="signingOut"
                @click="signOut"
              />
            </template>
          </VListItem>
        </template>
      </VNavigationDrawer>

      <VAppBar flat border="b" height="64" class="app-bar">
        <VAppBarNavIcon v-if="mobile" @click="drawer = !drawer" />
        <VAppBarTitle class="font-weight-bold">{{ route.meta.title || 'Задачи Линки' }}</VAppBarTitle>
        <template #append>
          <VBtn icon="mdi-magnify" variant="text" aria-label="Поиск" to="/?focus=q" />
          <VAvatar class="ml-2 mr-4" color="primary" variant="tonal" size="34">
            {{ initials(user?.displayName || user?.username || '') }}
          </VAvatar>
        </template>
      </VAppBar>
    </template>

    <VMain>
      <NuxtPage />
    </VMain>

    <VBottomNavigation v-if="isAppPage && mobile" grow color="primary" elevation="10">
      <VBtn v-for="item in navigation" :key="item.to" :to="item.to" :value="item.to">
        <VIcon>{{ item.icon }}</VIcon>
        <span>{{ item.title }}</span>
      </VBtn>
    </VBottomNavigation>
  </VApp>
</template>
