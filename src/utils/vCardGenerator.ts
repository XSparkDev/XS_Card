export interface Contact {
  name: string;
  surname: string;
  phone: string;
  email?: string;
  company?: string;
  howWeMet: string;
  createdAt: string;
}

export const generateVCard = (contact: Contact): string => {
  const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:${contact.name} ${contact.surname}
N:${contact.surname};${contact.name};;;
EMAIL:${contact.email || ''}
TEL;TYPE=CELL:${contact.phone || ''}${contact.company ? `
ORG:${contact.company}` : ''}
NOTE:Met at: ${contact.howWeMet}${contact.createdAt ? `\nAdded: ${contact.createdAt}` : ''}
END:VCARD`;

  return vCardData;
};

export const generateMultipleVCards = (contacts: Contact[]): string => {
  return contacts.map(contact => generateVCard(contact)).join('\n\n');
};

export const generateFileName = (contact: Contact): string => {
  // Remove special characters and spaces for filename
  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sanitizeName(contact.name)}_${sanitizeName(contact.surname)}.vcf`;
};

export const generateBatchFileName = (count: number): string => {
  const date = new Date().toISOString().split('T')[0];
  return `XS_Card_Contacts_${count}_${date}.vcf`;
}; 