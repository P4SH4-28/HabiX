// ============================================================
// SocialScreen — "Sosyal" sekmesi (v3 design system, sıfırdan)
//
// Üstte SegmentedTabs ile üç bölüm:
//   👥 Arkadaşlar → FriendsScreen (liste + ekle + düello + profil ziyareti)
//   🍅 Canlı Odalar → LiveRooms (olustur/katıl/ayrıl, realtime, EmptyState)
//   💬 Sohbet → ChatTab (mesaj listesi + input, EmptyState/ErrorState)
// Her sekmenin boş durumu EmptyState primitive'i ile gösterilir.
//
// DataContext API (değişmedi): children kendi hook'larını kullanır.
//
// SAFE AREA: TAB ekranı — AppHeader 'Sosyal' (üst), PillTabBar (alt).
// KURALLAR: glow/gradient/blur/loop YOK · animasyon ≤300ms (primitive) ·
//   h1 yok (AppHeader).
// ============================================================
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import FriendsScreen from './FriendsScreen';
import LiveRooms from '../components/LiveRooms';
import ChatTab from '../components/ChatTab';
import SegmentedTabs from '../components/ui/SegmentedTabs';

const TABS = [
  { key: 'friends', label: 'Arkadaşlar', icon: '👥' },
  { key: 'rooms', label: 'Canlı Odalar', icon: '🍅' },
  { key: 'chat', label: 'Sohbet', icon: '💬' },
];

export default function SocialScreen() {
  const [tab, setTab] = useState('friends');

  return (
    <View style={styles.container}>
      <SegmentedTabs
        options={TABS}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />
      <View style={styles.content}>
        {tab === 'friends' && <FriendsScreen />}
        {tab === 'rooms' && <LiveRooms />}
        {tab === 'chat' && <ChatTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
  },
  tabs: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
