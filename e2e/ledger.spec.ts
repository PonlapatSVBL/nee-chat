import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createTestUser, deleteTestUser, loginAs } from './helpers/auth';

// The package is ESM ("type": "module"), so CommonJS `__dirname` is not defined.
const here = path.dirname(fileURLToPath(import.meta.url));
const email = `e2e-${Date.now()}@example.com`;
let userId: string;

test.beforeAll(async () => {
  userId = await createTestUser(email);
});

test.afterAll(async () => {
  await deleteTestUser(userId);
});

test('setup loan, record payment with slip, correct it, void it', async ({ page }) => {
  await loginAs(page, email);
  await expect(page).toHaveURL(/\/setup$/);

  // Loan setup
  await page.getByLabel('ชื่อเงินกู้').fill('กยศ. ทดสอบ');
  await page.getByLabel('ยอดหนี้ตั้งต้น').fill('195420.50');
  await page.getByLabel('ยอดนี้เป็นของวันที่').fill('2026-06-30');
  await page.getByLabel('ยอดจ่ายประจำ (ถ้ามี)').fill('3000');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  // the opening balance appears both as the hero number and in the hint line
  await expect(page.getByText('195,420.50').first()).toBeVisible();
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();

  // Record a payment with a slip
  await page.getByRole('link', { name: 'บันทึกการชำระ' }).click();
  await expect(page).toHaveURL(/\/payments\/new$/);
  await expect(page.getByLabel('จำนวนเงิน')).toHaveValue('3000.00');
  await page.getByLabel('วันที่ชำระ').fill('2026-10-04');
  await page.getByLabel('เลขอ้างอิง').fill('REF-E2E');
  await page.getByTestId('gallery-input').setInputFiles(path.join(here, 'fixtures/slip.png'));
  await expect(page.getByAltText('สลิป 1')).toBeVisible();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();

  // List
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.getByText('ตุลาคม 2569')).toBeVisible();
  await expect(page.getByText('ยอดหลังชำระ 192,420.50')).toBeVisible();

  // Detail
  await page.getByRole('link', { name: /3,000\.00/ }).first().click();
  await expect(page).toHaveURL(/\/payments\/[0-9a-f-]{36}$/);
  await expect(page.getByText('REF-E2E')).toBeVisible();
  await expect(page.getByAltText('สลิป 1')).toBeVisible();

  // Correct
  await page.getByRole('link', { name: 'แก้ไขรายการ' }).click();
  await expect(page.getByText('สลิปเดิม 1 ไฟล์จะติดไปกับรายการใหม่อัตโนมัติ')).toBeVisible();
  await page.getByLabel('จำนวนเงิน').fill('2500');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByText('กรุณาระบุเหตุผลที่แก้ไข')).toBeVisible();
  await page.getByLabel('เหตุผลที่แก้ไข').fill('พิมพ์ยอดผิด');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByText('แก้ไขจากรายการเดิม')).toBeVisible();
  await expect(page.getByText('2,500.00')).toBeVisible();
  await expect(page.getByAltText('สลิป 1')).toBeVisible();

  // Original is voided and linked
  await page.getByRole('link', { name: /ดูรายการเดิม/ }).click();
  await expect(page.getByText('รายการนี้ถูกยกเลิกแล้ว')).toBeVisible();
  await expect(page.getByText('เหตุผล: พิมพ์ยอดผิด')).toBeVisible();
  await page.getByRole('link', { name: 'ดูรายการที่แก้ไขแล้ว' }).click();

  // Void the replacement
  await page.getByRole('button', { name: 'ยกเลิกรายการ' }).click();
  await page.getByLabel('เหตุผล', { exact: true }).fill('บันทึกซ้ำ');
  await page.getByRole('button', { name: 'ยืนยันการยกเลิก' }).click();
  await expect(page.getByText('รายการนี้ถูกยกเลิกแล้ว')).toBeVisible();

  // Dashboard back to opening balance
  await page.goto('/');
  await expect(page.getByText('195,420.50').first()).toBeVisible();
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();

  // Voided rows hidden by default, shown on toggle
  await page.goto('/payments');
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();
  await page.getByRole('link', { name: 'แสดงรายการที่ยกเลิก' }).click();
  await expect(page.getByText('ยกเลิกแล้ว').first()).toBeVisible();
});
