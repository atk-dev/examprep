/**
 * Sample topics per subject, based on the ป.4–6 core curriculum. A starting point only:
 * users should rename/merge them to match their book and set real problem counts.
 * Keyed by the default subject names in defaults.ts.
 */
export const TOPIC_TEMPLATES: Record<string, string[]> = {
  คณิตศาสตร์: [
    'จำนวนนับและการประมาณ',
    'ห.ร.ม. และ ค.ร.น.',
    'เศษส่วน',
    'ทศนิยม',
    'อัตราส่วน',
    'ร้อยละ',
    'สมการและการแก้สมการ',
    'แบบรูปและความสัมพันธ์',
    'การวัด (ความยาว น้ำหนัก เวลา เงิน)',
    'มุมและเส้นขนาน',
    'รูปสามเหลี่ยม',
    'รูปสี่เหลี่ยม',
    'วงกลม',
    'ความยาวรอบรูปและพื้นที่',
    'ปริมาตรและความจุ',
    'สถิติและการนำเสนอข้อมูล',
  ],
  วิทยาศาสตร์: [
    'พืช',
    'สัตว์',
    'การจำแนกสิ่งมีชีวิต',
    'ร่างกายมนุษย์',
    'ห่วงโซ่อาหารและระบบนิเวศ',
    'ลักษณะทางพันธุกรรม',
    'สมบัติของวัสดุ',
    'สถานะของสสาร',
    'การแยกสาร',
    'การเปลี่ยนแปลงของสาร',
    'แรงและการเคลื่อนที่',
    'แสงและเงา',
    'เสียง',
    'ไฟฟ้าและวงจรไฟฟ้า',
    'ระบบสุริยะและดวงจันทร์',
    'ดาวและปรากฏการณ์ทางดาราศาสตร์',
    'หิน แร่ และซากดึกดำบรรพ์',
    'ลมฟ้าอากาศและวัฏจักรน้ำ',
    'ภัยธรรมชาติ',
  ],
  ภาษาอังกฤษ: [
    'Tenses',
    'Parts of Speech',
    'Articles และ Nouns',
    'Pronouns',
    'Prepositions',
    'Adjectives และ Comparison',
    'Modal Verbs',
    'Question Words',
    'Conjunctions',
    'Vocabulary',
    'Conversation',
    'Reading Comprehension',
    'Signs และ Notices',
  ],
  สังคมศึกษา: [
    'พุทธประวัติและศาสนาอื่น',
    'หลักธรรมและชาดก',
    'วันสำคัญและศาสนพิธี',
    'สิทธิและหน้าที่พลเมือง',
    'กฎหมายเบื้องต้น',
    'การปกครองระบอบประชาธิปไตย',
    'เศรษฐศาสตร์และเศรษฐกิจพอเพียง',
    'เวลาและยุคสมัยทางประวัติศาสตร์',
    'สุโขทัยและอยุธยา',
    'ธนบุรีและรัตนโกสินทร์',
    'อาเซียน',
    'แผนที่และเครื่องมือภูมิศาสตร์',
    'ภูมิภาคของไทย',
    'ทวีปเอเชียและทรัพยากร',
  ],
  ภาษาไทย: [
    'อักษรสามหมู่และการผันวรรณยุกต์',
    'มาตราตัวสะกด',
    'คำเป็นคำตายและคำครุลหุ',
    'ชนิดของคำ',
    'คำประสม คำซ้ำ คำซ้อน',
    'คำราชาศัพท์',
    'คำยืมภาษาต่างประเทศ',
    'ประโยค',
    'การสะกดคำและเครื่องหมายวรรคตอน',
    'สำนวน สุภาษิต คำพังเพย',
    'การอ่านจับใจความ',
    'ฉันทลักษณ์',
    'วรรณคดีลำนำ',
  ],
};

export const DEFAULT_TEMPLATE_COUNT = 20;
export const MAX_TEMPLATE_COUNT = 300;

/** Clamp a typed count to 1..MAX; anything unparsable falls back to the default. */
export function clampCount(v: string | number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TEMPLATE_COUNT;
  return Math.min(n, MAX_TEMPLATE_COUNT);
}

export const templateFor = (subjectName: string) => TOPIC_TEMPLATES[subjectName] ?? null;

export const templateItems = (names: string[], count: number) =>
  names.map((name) => ({ name, problemCount: clampCount(count) }));

/** Editor text for a template: one "ชื่อหัวข้อ, จำนวนข้อ" line per topic. */
export const templateText = (names: string[], count: number) =>
  templateItems(names, count).map((t) => `${t.name}, ${t.problemCount}`).join('\n');
