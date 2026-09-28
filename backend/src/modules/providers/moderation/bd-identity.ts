
export interface NidCheck {
  valid: boolean;
  reason?: string;
}

export function validateNid(raw: string | number | null | undefined): NidCheck {
  if (raw === null || raw === undefined) {
    return { valid: false, reason: 'NID is missing' };
  }
  const nid = String(raw).trim();

 
  if (!/^\d+$/.test(nid)) {
    return { valid: false, reason: 'NID contains non-digit characters' };
  }

  
  if (![10, 13, 17].includes(nid.length)) {
    return { valid: false, reason: `NID has ${nid.length} digits (expected 10, 13 or 17)` };
  }

 
  if (/^(\d)\1+$/.test(nid)) {
    return { valid: false, reason: 'NID is all the same digit' };
  }


  if (nid.length === 17) {
    const year = parseInt(nid.slice(0, 4), 10);
    const thisYear = new Date().getFullYear();
    if (year < 1900 || year > thisYear) {
      return { valid: false, reason: `NID birth year ${year} is not plausible` };
    }
  }

  return { valid: true };
}


export interface LicenceCheck {
  valid: boolean;
  reason?: string;
}

export function validateTradeLicence(raw: string | number | null | undefined): LicenceCheck {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { valid: false, reason: 'Trade licence is missing' };
  }
  const licence = String(raw).trim();


  const cleaned = licence.replace(/[\s-]/g, '');
  if (!/^[A-Za-z0-9]+$/.test(cleaned)) {
    return { valid: false, reason: 'Trade licence has unexpected characters' };
  }
  if (cleaned.length < 3 || cleaned.length > 20) {
    return { valid: false, reason: `Trade licence length (${cleaned.length}) looks wrong` };
  }

  if (/^(.)\1+$/.test(cleaned)) {
    return { valid: false, reason: 'Trade licence is all the same character' };
  }

  return { valid: true };
}
