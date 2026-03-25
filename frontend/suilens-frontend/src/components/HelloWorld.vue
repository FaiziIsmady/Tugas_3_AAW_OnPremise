<template>
  <v-container class="py-8" max-width="800">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Live Order Notifications</span>
        <v-chip size="small" :color="isConnected ? 'success' : 'warning'">
          {{ isConnected ? "Connected" : "Disconnected" }}
        </v-chip>
      </v-card-title>

      <v-divider />

      <v-card-text class="py-6" style="min-height: 500px">
        <div
          v-if="notifications.length === 0"
          class="text-center text-grey py-8"
        >
          <p class="text-sm">No notifications yet</p>
        </div>

        <div v-else>
          <div
            v-for="(notification, index) in notifications"
            :key="notification.timestamp + index"
            class="mb-4 pb-4"
            :style="
              index < notifications.length - 1
                ? 'border-bottom: 1px solid #eee;'
                : ''
            "
          >
            <p class="text-sm ma-0">
              Order placed for {{ notification.data.lensName }} by
              {{ notification.data.customerName }}
            </p>
            <p class="text-xs text-grey-darken-1 mt-1">
              {{ formatTime(notification.timestamp) }}
            </p>
          </div>
        </div>
      </v-card-text>

      <v-divider v-if="notifications.length > 0" />
      <v-card-actions v-if="notifications.length > 0">
        <v-spacer />
        <v-btn size="small" variant="text" @click="clearNotifications">
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const NOTIFICATION_WS =
  import.meta.env.VITE_NOTIFICATION_WS || "ws://localhost:3003/ws/notifications";

const notifications = ref([]);
const isConnected = ref(false);

let socket = null;
let reconnectTimer = null;

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clearNotifications() {
  notifications.value = [];
}

function connectWebSocket() {
  socket = new WebSocket(NOTIFICATION_WS);

  socket.onopen = () => {
    isConnected.value = true;
  };

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "order.placed") {
      notifications.value.unshift(payload);
    }
  };

  socket.onclose = () => {
    isConnected.value = false;
    reconnectTimer = window.setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = () => {
    isConnected.value = false;
    socket?.close();
  };
}

onMounted(() => {
  connectWebSocket();
});

onBeforeUnmount(() => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  if (socket) {
    socket.close();
  }
});
</script>
