// ============================================================
// icons.js — Premium ikonografi yardımcıları.
// UI'da kullanılan emoji'leri Ionicons adlarına eşler; dönüşüm tek
// yerde tutulur. Emoji bilinmiyorsa (kullanıcı içeriği) emoji olarak
// render edilir — avatar/dükkan/alışkanlık içerikleri bozulmaz.
// ============================================================
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Geçerli Ionicons adları kümesi (createIconSet `glyphMap`'i statik olarak
// açar). `emoji` prop'uyla İKON ADI geçen çağrıları da yakalarız.
const IONICON_NAMES = Ionicons.glyphMap;

export const ICON_MAP = {
  '🎯': 'navigate',
  '🔔': 'notifications',
  '🔕': 'notifications-off',
  '🍅': 'timer',
  '🏆': 'trophy',
  '🚀': 'rocket',
  '📡': 'radio',
  '💬': 'chatbubble',
  '⚔': 'flash',
  '💡': 'bulb',
  '📊': 'bar-chart',
  '⚠': 'warning',
  '📋': 'clipboard',
  '🔍': 'search',
  '🎁': 'gift',
  '🎨': 'color-palette',
  '⚖': 'scale',
  '📜': 'document-text',
  '💰': 'cash',
  '🔒': 'lock-closed',
  '✨': 'star',
  '⚡': 'flash',
  '🪙': 'cash',
  '🔥': 'flame',
  '✅': 'checkmark',
  '✓': 'checkmark',
  '❄': 'snow',
  '👋': 'hand-left',
  '🗑': 'trash',
  '📅': 'calendar',
  '📷': 'camera',
  '💍': 'diamond',
  '👁': 'eye',
  '🎤': 'mic',
  '🎒': 'bag-handle',
  '🛍': 'bag',
  '🖼': 'image',
  '🥇': 'medal',
  '🥈': 'medal',
  '🥉': 'medal',
  '🛡': 'shield-checkmark',
  '👤': 'person',
  '🌱': 'leaf',
  '🏃': 'body',
  '🎖': 'medal',
  '💎': 'diamond',
  '👑': 'crown',
  '🕐': 'time',
  '⏳': 'hourglass',
  '▶': 'play',
  '⏸': 'pause',
  '↺': 'refresh',
  '✏': 'create',
  '⛔': 'ban',
  '💪': 'barbell',
  '💧': 'water',
  '📖': 'book',
  '🧘': 'fitness',
};

// Emoji'yi ait olduğu Ionicons adına çevirir (bilinmiyorsa null).
export function iconForEmoji(emoji) {
  if (!emoji) return null;
  if (ICON_MAP[emoji]) return ICON_MAP[emoji];
  // DİKKAT: bazı ekranlar `emoji`/`icon` prop'uyla doğrudan İKON ADI geçiyordu
  // (IconTile icon="cube", AppMenu icon="flag"…). Haritada bulunmayınca Icon
  // bileşeni o string'i <Text> olarak basıyor ve ekranda "cube" yazısı
  // ikonun üstüne biniyordu. Geçerli bir Ionicons adıysa doğrudan ikon
  // olarak render et; gerçek emoji (avatar/içerik) yine metin olarak kalır.
  if (IONICON_NAMES && Object.prototype.hasOwnProperty.call(IONICON_NAMES, emoji)) {
    return emoji;
  }
  return null;
}

// Evrensel ikon render'ı: `name` (Ionicons) → `emoji` (haritadan eşleme) →
// map'te yoksa emoji içeriğin kendini render et (geriye uyumlu).
export default function Icon({ name, emoji, size = 18, color, style }) {
  const resolved = name || (emoji ? iconForEmoji(emoji) : null);
  if (!resolved) {
    return (
      <Text style={[{ fontSize: size, lineHeight: size * 1.2 }, style]}>{emoji || ''}</Text>
    );
  }
  return <Ionicons name={resolved} size={size} color={color} style={style} />;
}