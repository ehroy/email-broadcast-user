<template>
  <div class="eli-wrap">
    <!-- Card list -->
    <div v-if="modelValue.length" class="eli-cards">
      <div v-for="(email, index) in modelValue" :key="email" class="eli-row">
        <span class="eli-num">{{ index + 1 }}</span>
        <span class="eli-val">{{ email }}</span>
        <span class="eli-badge ok">✓ VALID</span>
        <button type="button" class="eli-del" @click="remove(email)">✕</button>
      </div>
    </div>

    <div v-else class="eli-empty">
      <span>Belum ada email — tambahkan di bawah</span>
    </div>

    <!-- Add row -->
    <div class="eli-add-row">
      <input
        ref="inputRef"
        v-model="inputVal"
        type="email"
        placeholder="tambah email..."
        autocomplete="off"
        :class="{ 'has-error': inputError }"
        @keydown.enter.prevent="add"
        @keydown.tab.prevent="add"
        @input="inputError = ''"
        @paste.prevent="onPaste"
      />
      <button type="button" class="eli-btn-add" @click="add">+ ADD</button>
    </div>

    <div v-if="inputError" class="eli-error">{{ inputError }}</div>

    <div class="eli-footer">
      <span class="eli-hint">
        Tekan <kbd>Enter</kbd> atau klik ADD — bisa juga <kbd>Ctrl+V</kbd> paste
        beberapa email sekaligus
      </span>
      <span v-if="modelValue.length" class="eli-count">
        {{ modelValue.length }} EMAIL{{ modelValue.length > 1 ? "S" : "" }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const inputVal = ref("");
const inputError = ref("");
const inputRef = ref(null);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const add = () => {
  const email = inputVal.value.trim().toLowerCase();
  if (!email) return;

  if (!isValidEmail(email)) {
    inputError.value = `⚠ Format email tidak valid: ${email}`;
    return;
  }
  if (props.modelValue.includes(email)) {
    inputError.value = "⚠ Email sudah ditambahkan";
    return;
  }

  emit("update:modelValue", [...props.modelValue, email]);
  inputVal.value = "";
  inputError.value = "";
  inputRef.value?.focus();
};

const remove = (email) => {
  emit(
    "update:modelValue",
    props.modelValue.filter((e) => e !== email),
  );
};

// Paste beberapa email sekaligus (pisah koma / baris / spasi)
const onPaste = (e) => {
  const text = e.clipboardData.getData("text");
  const emails = text
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && isValidEmail(s));

  if (!emails.length) {
    inputVal.value = text.trim();
    return;
  }

  const existing = new Set(props.modelValue);
  const unique = emails.filter((em) => !existing.has(em));
  if (unique.length) {
    emit("update:modelValue", [...props.modelValue, ...unique]);
  }

  const skipped = emails.length - unique.length;
  if (skipped > 0) {
    inputError.value = `⚠ ${skipped} email duplikat dilewati`;
  }

  inputVal.value = "";
};
</script>

<style scoped>
.eli-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Empty state ── */
.eli-empty {
  padding: 16px;
  background: #f5f5f0;
  border: 4px solid #000;
  border-bottom: none;
  font-size: 13px;
  font-weight: 700;
  opacity: 0.45;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Card rows ── */
.eli-cards {
  border: 4px solid #000;
  border-bottom: none;
  background: #fff;
}

.eli-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 3px solid #f0f0ec;
  transition: background 0.1s;
  animation: rowIn 0.15s ease;
}

.eli-row:last-child {
  border-bottom: none;
}

.eli-row:hover {
  background: #fffde7;
}

@keyframes rowIn {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.eli-num {
  font-size: 11px;
  font-weight: 900;
  color: #aaa;
  min-width: 20px;
  text-align: right;
}

.eli-val {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eli-badge {
  font-size: 10px;
  font-weight: 900;
  padding: 3px 8px;
  border: 2px solid;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.eli-badge.ok {
  background: #d4f4e2;
  border-color: #0a7a74;
  color: #0a7a74;
}

.eli-del {
  background: #000;
  color: #fff;
  border: none;
  width: 26px;
  height: 26px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.1s;
}

.eli-del:hover {
  background: #ff6b6b;
}

/* ── Add row ── */
.eli-add-row {
  display: flex;
  gap: 0;
}

.eli-add-row input {
  flex: 1;
  border: 4px solid #000;
  padding: 13px 16px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  background: #fff;
  outline: none;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.1);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.eli-add-row input:focus {
  border-color: #4ecdc4;
  box-shadow: 6px 6px 0 rgba(78, 205, 196, 0.2);
  z-index: 1;
}

.eli-add-row input.has-error {
  border-color: #ff6b6b;
}

.eli-add-row input::placeholder {
  color: #aaa;
  font-weight: 600;
}

.eli-btn-add {
  background: #000;
  color: #fff;
  border: 4px solid #000;
  border-left: none;
  padding: 13px 24px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  font-family: inherit;
  white-space: nowrap;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.1s;
}

.eli-btn-add:hover {
  background: #4ecdc4;
  color: #000;
  border-color: #000;
}

.eli-btn-add:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
}

/* ── Footer ── */
.eli-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 6px;
}

.eli-hint {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.5;
}

.eli-hint kbd {
  background: #f0f0ec;
  border: 1.5px solid #ccc;
  padding: 1px 5px;
  font-size: 10px;
  font-family: inherit;
}

.eli-count {
  background: #000;
  color: #fff;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 900;
  border: 2px solid #000;
}

/* ── Error ── */
.eli-error {
  font-size: 11px;
  font-weight: 900;
  color: #cc2200;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 6px;
}
</style>
