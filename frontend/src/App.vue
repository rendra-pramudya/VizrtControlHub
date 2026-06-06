<template>
  <div id="layout">
    <nav>
      <router-link to="/engine">Engine</router-link>
      <router-link to="/pilot">Pilot</router-link>
      <router-link to="/mse">MSE</router-link>
      <router-link to="/hub">Hub</router-link>
      <router-link to="/udp">UDP</router-link>
      <router-link to="/settings">Settings</router-link>
    </nav>
    <main>
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #111; color: #eee; }
#layout { display: flex; flex-direction: column; min-height: 100vh; }
nav { display: flex; gap: 1rem; padding: 0.75rem 1.5rem; background: #1a1a2e; }
nav a { color: #aaa; text-decoration: none; font-size: 0.9rem; }
nav a.router-link-active { color: #fff; font-weight: bold; }
main { flex: 1; padding: 1.5rem; }
</style>
