import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dataSource from 'src/config/typeorm.config';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

const BRANDS = ['NISSAN', 'TOYOTA', 'CHEVROLET', 'FORD', 'VOLKSWAGEN', 'HONDA', 'KIA'];
const TYPES = ['NP300', 'HILUX', 'SILVERADO', 'RANGER', 'JETTA', 'CIVIC', 'RIO'];
const USE_TYPES = ['PATRULLA', 'PARTICULAR'];
const VEHICLE_CLASSES = ['SEDAN', 'PICK UP', 'MOTOCICLETA', 'GRUA', 'BICICLETA', 'MICROBUS'];
const PHYSICAL_STATUSES = ['BUENO', 'REGULAR', 'MALO'];
const STATUSES = ['ACTIVO', 'INCATIVO', 'SINIESTRADO', 'PARA BAJA', 'TALLER'];
const ASSET_CLASSIFICATIONS = ['PATRIMONIAL', 'ARRENDAMIENTO'];
const FIRST_NAMES = ['JUAN', 'PEDRO', 'LUIS', 'MARIO', 'JORGE', 'ANDRES', 'FERNANDO', 'ROBERTO'];
const LAST_NAMES = ['PEREZ', 'LOPEZ', 'MARTINEZ', 'HERNANDEZ', 'RAMIREZ', 'GARCIA', 'SANCHEZ'];
const TEST_CUSTODIAN = 'CARREÑO ARMENTA HIRAM';

const TEST_VEHICLES = [
  { plates: 'OAX-HCA-001', brand: 'FORD', type: 'RANGER', useType: 'OPERATIVO', vehicleClass: 'CAMIONETA', model: '2024', engineNumber: 'HCA-ENG-001', serialNumber: 'HCA-SER-001', patrolNumber: 'P-101', physicalStatus: 'BUENO', status: 'ACTIVO', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: PATRULLA PICK UP.' },
  { plates: 'OAX-HCA-002', brand: 'NISSAN', type: 'NP300', useType: 'OPERATIVO', vehicleClass: 'CAMIONETA', model: '2023', engineNumber: 'HCA-ENG-002', serialNumber: 'HCA-SER-002', patrolNumber: 'P-102', physicalStatus: 'BUENO', status: 'ACTIVO', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: PATRULLA DE PROXIMIDAD.' },
  { plates: 'OAX-HCA-003', brand: 'HONDA', type: 'CBF 160', useType: 'OPERATIVO', vehicleClass: 'MOTOCICLETA', model: '2025', engineNumber: 'HCA-ENG-003', serialNumber: 'HCA-SER-003', patrolNumber: 'M-201', physicalStatus: 'BUENO', status: 'ACTIVO', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: MOTOPATRULLA.' },
  { plates: 'OAX-HCA-004', brand: 'YAMAHA', type: 'FZ 25', useType: 'OPERATIVO', vehicleClass: 'MOTOCICLETA', model: '2024', engineNumber: 'HCA-ENG-004', serialNumber: 'HCA-SER-004', patrolNumber: 'M-202', physicalStatus: 'REGULAR', status: 'ACTIVO', assetClassification: 'ARRENDAMIENTO', observation: 'UNIDAD DE PRUEBA: MOTOCICLETA DE VIGILANCIA.' },
  { plates: 'OAX-HCA-005', brand: 'CHEVROLET', type: 'SILVERADO 3500', useType: 'OPERATIVO', vehicleClass: 'GRUA', model: '2022', engineNumber: 'HCA-ENG-005', serialNumber: 'HCA-SER-005', patrolNumber: 'G-301', physicalStatus: 'REGULAR', status: 'ACTIVO', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: GRUA PARA APOYO VIAL.' },
  { plates: 'OAX-HCA-006', brand: 'TOYOTA', type: 'HIACE', useType: 'ADMINISTRATIVO', vehicleClass: 'MINIBUS CARROCERIA ALUVAN', model: '2021', engineNumber: 'HCA-ENG-006', serialNumber: 'HCA-SER-006', patrolNumber: 'T-401', physicalStatus: 'BUENO', status: 'ACTIVO', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: TRASLADO DE PERSONAL.' },
  { plates: 'OAX-HCA-007', brand: 'VOLKSWAGEN', type: 'JETTA', useType: 'ADMINISTRATIVO', vehicleClass: 'AUTOMOVIL', model: '2020', engineNumber: 'HCA-ENG-007', serialNumber: 'HCA-SER-007', patrolNumber: 'A-501', physicalStatus: 'REGULAR', status: 'ACTIVO', assetClassification: 'ARRENDAMIENTO', observation: 'UNIDAD DE PRUEBA: VEHICULO ADMINISTRATIVO.' },
  { plates: 'OAX-HCA-008', brand: 'KIA', type: 'RIO', useType: 'SUSTANTIVO', vehicleClass: 'AUTOMOVIL', model: '2019', engineNumber: 'HCA-ENG-008', serialNumber: 'HCA-SER-008', patrolNumber: 'A-502', physicalStatus: 'MALO', status: 'PARA BAJA', assetClassification: 'PATRIMONIAL', observation: 'UNIDAD DE PRUEBA: UNIDAD PARA BAJA.' },
] as const;

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPlate() {
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(randomBetween(65, 90)),
  ).join('');
  const numbers = String(randomBetween(0, 999)).padStart(3, '0');
  return `${letters}-${numbers}`;
}

function randomDigits(length: number) {
  return Array.from({ length }, () => randomBetween(0, 9)).join('');
}

function randomDateWithinLastYear() {
  const now = Date.now();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const timestamp = randomBetween(oneYearAgo.getTime(), now);
  return new Date(timestamp);
}

function randomCustodian() {
  return `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`;
}

async function run() {
  const source = dataSource as DataSource;
  const onlyExamples = process.argv.includes('--examples');
  await source.initialize();

  try {
    const delegationRepository = source.getRepository(DelegationEntity);
    const userRepository = source.getRepository(UserEntity);

    const delegations = await delegationRepository.find({
      relations: {
        region: true,
      },
    });

    if (delegations.length === 0) {
      throw new Error('No hay delegaciones en la base de datos. Ejecuta el bootstrap de catálogo primero.');
    }

    const users = await userRepository.find({
      where: {
        isActive: true,
      },
    });

    if (users.length === 0) {
      throw new Error('No hay usuarios activos en la base de datos para asignar createdBy.');
    }

    const createdBy = users[0];
    let insertedExamples = 0;

    for (const vehicle of TEST_VEHICLES) {
      const existingVehicle = await source.query(
        'SELECT 1 FROM "records" WHERE "plates" = $1 LIMIT 1',
        [vehicle.plates],
      );

      if (existingVehicle.length > 0) {
        continue;
      }

      await source.query(
        `
          INSERT INTO "records" (
            "plates", "brand", "type", "useType", "vehicleClass", "model",
            "engineNumber", "serialNumber", "custodian", "patrolNumber",
            "physicalStatus", "status", "assetClassification", "observation",
            "delegationId", "createdById"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
        `,
        [
          vehicle.plates, vehicle.brand, vehicle.type, vehicle.useType,
          vehicle.vehicleClass, vehicle.model, vehicle.engineNumber,
          vehicle.serialNumber, TEST_CUSTODIAN, vehicle.patrolNumber,
          vehicle.physicalStatus, vehicle.status, vehicle.assetClassification,
          vehicle.observation, delegations[0].id, createdBy.id,
        ],
      );
      insertedExamples += 1;
    }

    if (onlyExamples) {
      const examples = await source.query(
        'SELECT "plates", "vehicleClass", "patrolNumber" FROM "records" WHERE "custodian" = $1 AND "plates" LIKE $2 ORDER BY "plates"',
        [TEST_CUSTODIAN, 'OAX-HCA-%'],
      );

      console.log(
        `Ejemplos completados: ${examples.length}/8 disponibles; ${insertedExamples} insertados en esta ejecución.`,
      );
      console.table(examples);
      return;
    }

    for (let index = 0; index < 35; index += 1) {
      const delegation = pickRandom(delegations);
      const date = randomDateWithinLastYear();

      const brand = pickRandom(BRANDS);
      const type = pickRandom(TYPES);
      const vehicleClass = pickRandom(VEHICLE_CLASSES);
      const status = pickRandom(STATUSES);
      const physicalStatus = pickRandom(PHYSICAL_STATUSES);

      await source.query(
        `
          INSERT INTO "records" (
            "plates",
            "brand",
            "type",
            "useType",
            "vehicleClass",
            "model",
            "engineNumber",
            "serialNumber",
            "custodian",
            "patrolNumber",
            "physicalStatus",
            "status",
            "assetClassification",
            "observation",
            "delegationId",
            "createdById",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17
          )
        `,
        [
          randomPlate(),
          brand,
          type,
          pickRandom(USE_TYPES),
          vehicleClass,
          String(randomBetween(2012, 2026)),
          `EN-${randomDigits(10)}`,
          `SN-${randomDigits(12)}`,
          randomCustodian(),
          `P-${String(randomBetween(1, 999)).padStart(3, '0')}`,
          physicalStatus,
          status,
          pickRandom(ASSET_CLASSIFICATIONS),
          `REGISTRO GENERADO AUTOMATICAMENTE ${index + 1}`,
          delegation.id,
          createdBy.id,
          date,
        ],
      );
    }

    console.log('Seed completado: se insertaron 35 registros vehiculares.');
  } finally {
    await source.destroy();
  }
}

void run().catch((error) => {
  console.error('Error al ejecutar seed de vehículos:', error);
  process.exit(1);
});
