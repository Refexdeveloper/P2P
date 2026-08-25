import { CurrencyCode } from '../../../constants/currency';

/** Real Create PR form field names — add/remove/reorder questions here. */
export type PrHeaderField =
  | 'purchaseType'
  | 'prTitle'
  | 'entityId'
  | 'department'
  | 'requestType'
  | 'priority'
  | 'currency'
  | 'requiredDate'
  | 'vendorSelection'
  | 'businessJustification';

export type LineItemField = 'itemId' | 'description' | 'category' | 'quantity' | 'estimatedCost';

export type QuestionInput =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'choice'
  | 'entity'
  | 'department'
  | 'item'
  | 'category';

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface PrQuestionConfig {
  field: PrHeaderField;
  question: string;
  required: boolean;
  input: QuestionInput;
  options?: ChoiceOption[];
}

export interface LineItemQuestionConfig {
  field: LineItemField;
  question: string;
  required: boolean;
  input: QuestionInput;
}

export interface PrConversationAnswers {
  purchaseType?: 'purchase_order' | 'work_order';
  prTitle?: string;
  entityId?: number | '';
  department?: string;
  requestType?: 'Capex' | 'Opex' | 'Service';
  priority?: string;
  currency?: CurrencyCode;
  requiredDate?: string;
  vendorSelection?: 'own' | 'scm';
  businessJustification?: string;
}

export interface ConversationLineItem {
  id: string;
  itemId?: number | null;
  itemName?: string;
  description: string;
  quantity: number;
  estimatedCost: number;
  category: string;
  unit?: string;
  hsnCode?: string;
  gstPercentage?: number;
}

export const PR_HEADER_QUESTIONS: PrQuestionConfig[] = [
  {
    field: 'purchaseType',
    question: 'What is the purchase type?',
    required: true,
    input: 'choice',
    options: [
      { value: 'purchase_order', label: 'Purchase Order' },
      { value: 'work_order', label: 'Work Order' },
    ],
  },
  {
    field: 'prTitle',
    question: 'What is the PR title?',
    required: true,
    input: 'text',
  },
  {
    field: 'entityId',
    question: 'Which entity is this purchase for?',
    required: true,
    input: 'entity',
  },
  {
    field: 'department',
    question: 'Which department is requesting this purchase?',
    required: true,
    input: 'department',
  },
  {
    field: 'requestType',
    question: 'What is the request type?',
    required: true,
    input: 'choice',
    options: [
      { value: 'Capex', label: 'Capex' },
      { value: 'Opex', label: 'Opex' },
      { value: 'Service', label: 'Service' },
    ],
  },
  {
    field: 'priority',
    question: 'What is the priority?',
    required: false,
    input: 'choice',
    options: [
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
      { value: 'Critical', label: 'Critical' },
    ],
  },
  {
    field: 'currency',
    question: 'Which currency should be used?',
    required: true,
    input: 'choice',
    options: [
      { value: 'INR', label: 'INR (₹)' },
      { value: 'USD', label: 'USD ($)' },
      { value: 'EUR', label: 'EUR (€)' },
    ],
  },
  {
    field: 'requiredDate',
    question: 'When is this purchase required?',
    required: true,
    input: 'date',
  },
  {
    field: 'vendorSelection',
    question: 'Who should select the vendor?',
    required: true,
    input: 'choice',
    options: [
      { value: 'scm', label: 'SCM vendor Selection' },
      { value: 'own', label: 'Own vendor' },
    ],
  },
  {
    field: 'businessJustification',
    question: 'What is the business justification?',
    required: true,
    input: 'textarea',
  },
];

export const LINE_ITEM_QUESTIONS: LineItemQuestionConfig[] = [
  {
    field: 'itemId',
    question: 'Which item from Item Master?',
    required: true,
    input: 'item',
  },
  {
    field: 'description',
    question: 'What is the item description?',
    required: true,
    input: 'textarea',
  },
  {
    field: 'category',
    question: 'What is the category?',
    required: true,
    input: 'category',
  },
  {
    field: 'quantity',
    question: 'What is the quantity?',
    required: true,
    input: 'number',
  },
  {
    field: 'estimatedCost',
    question: 'What is the unit price?',
    required: true,
    input: 'number',
  },
];

export const FIELD_LABELS: Record<PrHeaderField, string> = {
  purchaseType: 'Purchase Type',
  prTitle: 'PR Title',
  entityId: 'Entity',
  department: 'Department',
  requestType: 'Request Type',
  priority: 'Priority',
  currency: 'Currency',
  requiredDate: 'Required Date',
  vendorSelection: 'Vendor Selection',
  businessJustification: 'Business Justification',
};

export function emptyConversationLineItem(): ConversationLineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: null,
    itemName: '',
    description: '',
    quantity: 1,
    estimatedCost: 0,
    category: '',
    unit: 'Nos',
    hsnCode: '',
    gstPercentage: 18,
  };
}

export function requestTypeChoices(purchaseType?: string): ChoiceOption[] {
  if (purchaseType === 'work_order') {
    return [
      { value: 'Capex', label: 'Capex' },
      { value: 'Opex', label: 'Opex' },
      { value: 'Service', label: 'Service' },
    ];
  }
  return [
    { value: 'Capex', label: 'Capex' },
    { value: 'Opex', label: 'Opex' },
  ];
}

export function formatHeaderAnswer(
  field: PrHeaderField,
  answers: PrConversationAnswers,
  entityLabel?: string
): string {
  switch (field) {
    case 'purchaseType':
      return answers.purchaseType === 'work_order' ? 'Work Order' : answers.purchaseType === 'purchase_order' ? 'Purchase Order' : '';
    case 'entityId':
      return entityLabel || (answers.entityId ? String(answers.entityId) : '');
    case 'vendorSelection':
      return answers.vendorSelection === 'own' ? 'Own vendor' : answers.vendorSelection === 'scm' ? 'SCM vendor Selection' : '';
    default: {
      const value = answers[field];
      return value == null || value === '' ? '' : String(value);
    }
  }
}
