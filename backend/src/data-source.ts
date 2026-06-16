import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createTypeOrmOptions } from './config/typeorm.config';

const dataSource = new DataSource(createTypeOrmOptions());

export default dataSource;
