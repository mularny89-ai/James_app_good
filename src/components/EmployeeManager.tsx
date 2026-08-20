"use client";

import { useState } from "react";
import { saveEmployee, deleteEmployee, toggleEmployee } from "@/lib/actions/employees";
import { Field } from "@/components/ui";

export type EmployeeRow = {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string;
  position: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  assignable: boolean;
};

const blank: EmployeeRow = {
  id: 0, firstName: "", lastName: "", displayName: "", position: "",
  email: "", phone: "", notes: "", active: true, assignable: true,
};

export default function EmployeeManager({ employees }: { employees: EmployeeRow[] }) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-title">Employees</h3>
        <button type="button" className="btn-primary" onClick={() => setEditing(blank)}>+ Add Employee</button>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="th">Name</th>
            <th className="th">Position</th>
            <th className="th">Email</th>
            <th className="th">Phone</th>
            <th className="th">Active</th>
            <th className="th">Assignable</th>
            <th className="th w-32"></th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr><td colSpan={7} className="td text-center text-ink-muted">No employees yet — add one above.</td></tr>
          )}
          {employees.map((e) => (
            <tr key={e.id} className="border-b border-line">
              <td className="td font-medium">{e.displayName}</td>
              <td className="td">{e.position}</td>
              <td className="td">{e.email}</td>
              <td className="td">{e.phone}</td>
              <td className="td">{e.active ? "Yes" : <span className="text-ink-muted">No</span>}</td>
              <td className="td">{e.assignable ? "Yes" : <span className="text-ink-muted">No</span>}</td>
              <td className="td whitespace-nowrap text-right">
                <button type="button" className="link mr-2" onClick={() => setEditing(e)}>Edit</button>
                <button type="button" className="link mr-2" onClick={() => toggleEmployee(e.id, "active")}>{e.active ? "Deactivate" : "Activate"}</button>
                <button type="button" className="link text-err" onClick={() => deleteEmployee(e.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <form
          action={async (fd: FormData) => { await saveEmployee(fd); setEditing(null); }}
          className="mt-4 rounded-md border border-line bg-gray-50 p-4"
        >
          <input type="hidden" name="employeeId" value={editing.id} />
          <h4 className="mb-3 font-semibold">{editing.id ? "Edit Employee" : "Add Employee"}</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First Name"><input name="firstName" className="input" defaultValue={editing.firstName} /></Field>
            <Field label="Last Name"><input name="lastName" className="input" defaultValue={editing.lastName} /></Field>
            <Field label="Display Name"><input name="displayName" className="input" defaultValue={editing.displayName} placeholder="Defaults to First Last" /></Field>
            <Field label="Position / Job Title"><input name="position" className="input" defaultValue={editing.position} placeholder="e.g. Structural Engineer" /></Field>
            <Field label="Email"><input type="email" name="email" className="input" defaultValue={editing.email} /></Field>
            <Field label="Phone"><input name="phone" className="input" defaultValue={editing.phone} /></Field>
            <Field label="Notes" className="sm:col-span-3"><input name="notes" className="input" defaultValue={editing.notes} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing.active} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="assignable" defaultChecked={editing.assignable} /> Can Be Assigned To Jobs
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn-primary">{editing.id ? "Save Employee" : "Create Employee"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
