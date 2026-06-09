/**
 * EmployeeDAO.ts
 *
 * Data Access Object for 'employees' table.
 * Manages insertions, retrievals, and demo seeding of personnel files and reference vectors.
 */

import { SQLiteClient } from './SQLiteClient';

export interface Employee {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  face_embedding: number[] | null;
}

export class EmployeeDAO {
  /**
   * Inserts a new employee into the database.
   */
  public static insertEmployee(employee: Employee): void {
    const db = SQLiteClient.getDb();
    
    let embeddingBlob: Uint8Array | null = null;
    if (employee.face_embedding) {
      const float32Arr = new Float32Array(employee.face_embedding);
      embeddingBlob = new Uint8Array(float32Arr.buffer);
    }

    db.runSync(
      `INSERT OR REPLACE INTO employees (employee_id, name, department, designation, face_embedding) 
       VALUES (?, ?, ?, ?, ?);`,
      [
        employee.employee_id,
        employee.name,
        employee.department,
        employee.designation,
        embeddingBlob
      ]
    );
  }

  /**
   * Retrieves an employee profile by ID.
   */
  public static getEmployeeById(employeeId: string): Employee | null {
    const db = SQLiteClient.getDb();
    const row = db.getFirstSync<any>(
      'SELECT * FROM employees WHERE employee_id = ?;',
      [employeeId]
    );

    if (!row) return null;

    let face_embedding: number[] | null = null;
    if (row.face_embedding) {
      const buffer = row.face_embedding.buffer || row.face_embedding;
      const float32Arr = new Float32Array(buffer);
      face_embedding = Array.from(float32Arr);
    }

    return {
      employee_id: row.employee_id,
      name: row.name,
      department: row.department,
      designation: row.designation,
      face_embedding,
    };
  }

  /**
   * Seeds default mock profiles for the demo testing if the table is currently empty.
   */
  public static seedMockEmployees(): void {
    const db = SQLiteClient.getDb();
    const countRow = db.getFirstSync<any>('SELECT COUNT(*) as count FROM employees;');
    
    if (countRow && countRow.count > 0) {
      console.log('Employees table already seeded.');
      return;
    }

    console.log('Seeding mock employee profiles...');
    
    const mockEmployees: Employee[] = [
      {
        employee_id: 'EMP-001',
        name: 'Rahul Kumar',
        department: 'Operations & IT',
        designation: 'Field Officer',
        face_embedding: Array.from({ length: 128 }, () => 0.05),
      },
      {
        employee_id: 'EMP-7392',
        name: 'Rajesh Kumar',
        department: 'Hydrology Division',
        designation: 'Senior Hydrologist',
        face_embedding: Array.from({ length: 128 }, () => 0.1),
      },
      {
        employee_id: 'EMP-1204',
        name: 'Anjali Sharma',
        department: 'Telecom Infrastructure',
        designation: 'Network Engineer',
        face_embedding: Array.from({ length: 128 }, () => 0.15),
      }
    ];

    for (const emp of mockEmployees) {
      this.insertEmployee(emp);
    }

    console.log('Employee seeding complete.');
  }
}
