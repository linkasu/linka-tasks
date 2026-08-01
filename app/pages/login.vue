<script setup lang="ts">
definePageMeta({ layout: false, title: 'Вход' })

const step = ref<'username' | 'otp'>('username')
const username = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const { refresh } = useAuth()

function errorMessage(cause: unknown, fallback: string) {
  const failure = cause as { data?: { message?: string } }
  return failure.data?.message || fallback
}

async function requestCode() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/request-otp', { method: 'POST', body: { username: username.value } })
    step.value = 'otp'
  } catch (cause: unknown) {
    error.value = errorMessage(cause, 'Не удалось отправить код')
  } finally {
    loading.value = false
  }
}

async function verifyCode() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/verify-otp', { method: 'POST', body: { username: username.value, code: code.value } })
    await refresh()
    await navigateTo('/')
  } catch (cause: unknown) {
    error.value = errorMessage(cause, 'Неверный или просроченный код')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page d-flex align-center justify-center pa-4">
    <VCard width="440" max-width="100%" elevation="8">
      <VCardText class="pa-8">
        <VAvatar color="primary" size="56" class="mb-5">Л</VAvatar>
        <h1 class="text-h4 font-weight-bold mb-2">Задачи Линки</h1>
        <p class="text-medium-emphasis mb-7">Закрытое пространство команды АНО «Линка»</p>
        <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
        <VForm v-if="step === 'username'" @submit.prevent="requestCode">
          <VTextField v-model="username" label="Telegram username" prefix="@" autocomplete="username" autofocus />
          <VBtn type="submit" block color="primary" size="large" :loading="loading" :disabled="!username.trim()">
            Получить код в Telegram
          </VBtn>
        </VForm>
        <VForm v-else @submit.prevent="verifyCode">
          <p class="mb-4">Код отправлен пользователю <strong>@{{ username }}</strong>.</p>
          <VTextField v-model="code" label="Одноразовый код" inputmode="numeric" autocomplete="one-time-code" autofocus />
          <VBtn type="submit" block color="primary" size="large" :loading="loading" :disabled="code.length < 6">
            Войти
          </VBtn>
          <VBtn block variant="text" class="mt-2" @click="step = 'username'">Изменить username</VBtn>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  background:
    radial-gradient(circle at 15% 20%, rgba(24, 103, 192, 0.18), transparent 32rem),
    rgb(var(--v-theme-background));
}
</style>
