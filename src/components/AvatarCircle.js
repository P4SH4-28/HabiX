// ============================================================
// AvatarCircle — Daire şeklinde profil fotoğrafı
// - "photo" verilirse (kullanıcının yüklediği fotoğraf) Image gösterir;
//   yoksa emoji avatar'a düşer (dükkan ürünü ya da doğrudan emoji).
// - "frameId" verilirse avatarın etrafına çerçeve sarılır:
//   * Lottie çerçeveler (VIP): avatarın arkasında dönen animasyon.
//   * Emoji halkalı çerçeveler: halka YAVAŞÇA döner (boyut >= 44 ise,
//     küçük gösterimlerde performans için statik kalır).
// - Çerçeve varsa avatarın arkasına yumuşak bir ışıltı (glow) eklenir.
// ============================================================
import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import LottieView from 'lottie-react-native';
import { getAvatarEmoji, getFrame } from '../data/shop';
import { useTheme } from '../theme';

// Lottie animasyon kaynakları (assets/lottie/*.json).
export const LOTTIE_SOURCES = {
  heart: require('../../assets/lottie/heart.json'),
  flame: require('../../assets/lottie/flame.json'),
  glow: require('../../assets/lottie/glow.json'),
};

export function getLottieSource(frameId) {
  const frame = getFrame(frameId);
  if (!frame?.lottie) return null;
  return LOTTIE_SOURCES[frame.lottie] || null;
}

// Lottie çerçeve sarmalayıcısı: animasyonu avatarın arkasında döndürür.
export function LottieFrame({ frame, size, style, children }) {
  const source = getLottieSource(frame?.id);
  if (!source) return children;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <LottieView
        source={source}
        autoPlay
        loop
        style={{
          position: 'absolute',
          width: size * 1.9,
          height: size * 1.9,
        }}
      />
      {children}
    </View>
  );
}

// Çerçeve halkası: verilen emojiyi avatarın çevresinde 8 noktada gösterir.
// v2: 24 sn'lik sonsuz dönüş döngüsü KALDIRILDI → statik halka.
export function FrameDecor({ ring = '⭐', size = 64, style, children }) {
  const dots = [];
  const radius = size * 0.52;
  const dotSize = size * 0.2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    dots.push(
      <Text
        key={i}
        style={{
          position: 'absolute',
          left: size / 2 + Math.cos(angle) * radius - dotSize / 2,
          top: size / 2 + Math.sin(angle) * radius - dotSize / 2,
          fontSize: dotSize,
        }}
      >
        {ring}
      </Text>
    );
  }

  const ringView = (
    <View style={{ position: 'absolute', width: size, height: size }}>{dots}</View>
  );

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {ringView}
      {children}
    </View>
  );
}

export default function AvatarCircle({ avatarId, emoji, frameId, photo, size = 44, ringColor, style }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const resolved = emoji || (avatarId ? getAvatarEmoji(avatarId) : '😀');
  const frame = frameId ? getFrame(frameId) : null;

  const circleInner = photo && !photoFailed ? (
    <Image
      source={{ uri: photo }}
      style={{
        width: size - (frame ? 8 : 4),
        height: size - (frame ? 8 : 4),
        borderRadius: size / 2,
      }}
      onError={() => setPhotoFailed(true)}
    />
  ) : (
    <Text style={{ fontSize: size * 0.48 }}>{resolved}</Text>
  );

  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        ringColor ? { borderWidth: 2, borderColor: ringColor } : null,
        !frame && style,
      ]}
    >
      {circleInner}
    </View>
  );

  if (!frame) return circle;

  // Çerçeve varsa arkasına yumuşak ışıltı (glow) eklenir.
  const glowColor = frame.color || C.primary;
  const framed = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 0,
              blurRadius: size * 0.35,
              color: glowColor + '59',
            },
          ],
        },
        style,
      ]}
    >
      {circle}
    </View>
  );

  if (frame.lottie) {
    return (
      <LottieFrame frame={frame} size={size} style={style}>
        {framed}
      </LottieFrame>
    );
  }
  return (
    <FrameDecor ring={frame.emoji} size={size} style={style}>
      {framed}
    </FrameDecor>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    circle: {
      backgroundColor: C.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
}
