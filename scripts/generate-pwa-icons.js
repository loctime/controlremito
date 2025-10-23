const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Tamaños necesarios para PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('🎨 Generando iconos PWA...\n');
  
  const logoPath = path.join(__dirname, '../public/placeholder-logo.png');
  const outputDir = path.join(__dirname, '../public');
  
  // Verificar que el logo existe
  if (!fs.existsSync(logoPath)) {
    console.error('❌ No se encontró el logo en:', logoPath);
    console.log('💡 Asegúrate de tener placeholder-logo.png en /public/');
    return;
  }
  
  try {
    // Leer el logo original
    const logoBuffer = fs.readFileSync(logoPath);
    
    // Generar cada tamaño
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
      
      await sharp(logoBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generado: icon-${size}x${size}.png`);
    }
    
    console.log('\n🎉 ¡Iconos PWA generados exitosamente!');
    console.log('📱 Ahora tu PWA debería funcionar correctamente en iPhone');
    
  } catch (error) {
    console.error('❌ Error generando iconos:', error.message);
  }
}

generateIcons();