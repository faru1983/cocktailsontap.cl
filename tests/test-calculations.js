// Validación de lógica de negocios (Envío, Instalación, Totales)
// Ejecutar con: node tests/test-calculations.js

// Lógica de shipping (Copiada del proyecto para el test)
function calculateShipping(liters, comuna) {
    if (comuna === 'Providencia' || comuna === 'Las Condes') {
        return liters >= 30 ? 0 : 15000;
    }
    return 25000; // Otras comunas
}

// Lógica de instalación de Muro
function calculateInstallation(dispenser, liters) {
    if (dispenser === 'muro' && liters >= 30) {
        return 20000; // Costo base instalación muro
    }
    return 0;
}

function runTests() {
    console.log('🧮 Validando cálculos de negocio...');

    const cases = [
        {
            name: "Envío gratis Providencia +30L",
            result: calculateShipping(35, 'Providencia'),
            expected: 0
        },
        {
            name: "Envío cobrado Providencia <30L",
            result: calculateShipping(20, 'Providencia'),
            expected: 15000
        },
        {
            name: "Costo Muro habilitado +30L",
            result: calculateInstallation('muro', 30),
            expected: 20000
        },
        {
            name: "Costo Muro deshabilitado (pocos litros)",
            result: calculateInstallation('muro', 10),
            expected: 0
        }
    ];

    let passed = 0;
    cases.forEach(c => {
        if (c.result === c.expected) {
            console.log(`✅ ${c.name}: OK`);
            passed++;
        } else {
            console.error(`❌ ${c.name}: ERROR (Esperado ${c.expected}, obtenido ${c.result})`);
        }
    });

    console.log(`\n📊 Resultado: ${passed}/${cases.length} pruebas pasadas.`);
}

runTests();
