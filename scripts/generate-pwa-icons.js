// Script para generar iconos PWA a partir del logo existente
// Nota: Requiere que tengas instalado sharp o puedes usar servicios online
// Por ahora, este script sirve como documentación de los tamaños necesarios

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('📱 Iconos PWA necesarios:');
console.log('==========================\n');

sizes.forEach(size => {
  console.log(`✓ icon-${size}x${size}.png (${size}x${size}px)`);
});

console.log('\n💡 Opciones para generar los iconos:');
console.log('1. Usar herramienta online: https://realfavicongenerator.net/');
console.log('2. Usar herramienta online: https://www.pwabuilder.com/imageGenerator');
console.log('3. Instalar sharp y usar script automatizado: npm install sharp');
console.log('\n📂 Coloca los iconos generados en: /public/');
console.log('\n🎨 Logo actual: /public/placeholder-logo.png');

