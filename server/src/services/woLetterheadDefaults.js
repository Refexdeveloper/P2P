/**
 * Default Short / Long Work Order templates.
 * Adapted from Refex SugarCRM AOS Invoices Work Order masters.
 */

/** Short WO — face Terms + Annexure-I (Commercial) only */
export const SHORT_WO_LETTERHEAD_DEFAULTS = {
  title: 'Short WO',
  letterheadHeader:
    '<p style="text-align:center;"><strong><span style="text-decoration:underline;">WORK ORDER</span></strong></p>',
  terms: [
    {
      termsHeader: 'Completion Schedule',
      termsDescription: '<p>$aos_invoices_completion_schedule_c</p>',
    },
    {
      termsHeader: 'Payment Terms',
      termsDescription: '<p>$aos_invoices_payment_terms_c</p>',
    },
    {
      termsHeader: 'Notes',
      termsDescription: '<p>$aos_invoices_notes_c</p>',
    },
    {
      termsHeader: 'Annexures',
      termsDescription: '<p>Annexure I: Commercial Terms &amp; Conditions</p>',
    },
  ],
  annexure: [
    {
      termsHeader: 'Parties',
      termsDescription: `<p>This Work Order is issued by <strong>M/s [Company Name]</strong> hereinafter referred to as the Buyer to <strong>M/s [Vendor Name]</strong> hereinafter referred to as the Service Provider/ Seller. The Buyer &amp; the Service Provider / Seller will be referred collectively as Parties to this contract.</p>
<p>This Work Order shall constitute the contract (“order”)</p>`,
    },
    {
      termsHeader: 'Acceptance of Order',
      termsDescription: `<p>This Order will be deemed accepted by the Service Provider/ Seller upon the first of the following to occur: (a) Service Provider / Seller making, signing, or delivering to the Buyer any letter, form, or other writing or instrument acknowledging acceptance; (b) any performance by the Service Provider / Seller under the Order; or (c) the passage of two (2) days after Seller’s receipt of the Order without written notice to the Buyer that Seller does not accept. This Order, together with any documents incorporated herein by reference, constitutes the sole and entire agreement of the parties with respect to the Order and supersedes all prior or contemporaneous understandings, agreements, negotiations, representations, warranties and communications; both written and oral, with respect to the subject matter of the Order, unless a separate overriding written contract has been entered into and signed by the parties. The Order expressly limits The Seller’s acceptance to the terms of the Order. These Terms expressly exclude any of the Service provider’s/ Seller’s terms and conditions of sale or any other document issued by The Seller in connection with this Order.</p>`,
    },
    {
      termsHeader: 'Effective date and term',
      termsDescription: `<p>This Order will come into effect from the date of acceptance or deemed acceptance of this Order. This Order shall be in force till such time that the obligations of the Parties under this Order are fulfilled. The validity of this Order may be extended by the Parties on such terms as may be mutually agreed upon by and between the Parties in writing.</p>`,
    },
    {
      termsHeader: 'Work Schedule',
      termsDescription: `<p>The entire works shall be completed within 15 days from the date of order acceptance&amp; advance payment receipt. Time is the essence of the contract and must be strictly adhered to.</p>
<p>If the Service provider fails to satisfactorily complete the work or any part thereof in time, as stipulated under this contract, the buyer may at its sole discretion:</p>
<ol><li>Treat the Order as cancelled at any time and recover any loss or damage from the vendor, and/or</li></ol>
<p>Engage labour/sub vendor from other sources, to satisfactorily complete the work at vendor’s cost and risk, in which case, the vendor shall be liable to pay the buyer, not only the difference between the price at which such labour/sub-vendor have been engaged, but also any other loss or damage the buyer may suffer.</p>`,
    },
    {
      termsHeader: 'Documents to be submitted along with the invoices to the buyer',
      termsDescription: `<p>a) GST invoice original</p>
<p>b) Certification by the project consultant M/s WISMA</p>
<p>Document by Fax/Email: The Seller will send to Buyer the copies of invoice and other documents by e-mail/fax on the same day as per the date mentioned in the invoice. Original copies shall be sent to the designated address mentioned elsewhere in this order.</p>`,
    },
    {
      termsHeader: 'Price and Set-Off',
      termsDescription: `<p>The price of the Goods/services is the price stated on the face of this Order (the “<strong>Price</strong>”). The Service Provider /Seller shall invoice the Buyer for the Order as stated in the Payment Terms on the face of this Order. The price shall remain fix and firm till the complete execution of this order without any escalation.</p>`,
    },
    {
      termsHeader: 'Confidential Information',
      termsDescription: `<p>All non-public, confidential or proprietary information of the Buyer, including, but not limited to, specifications, samples, patterns, designs, plans, drawings, documents, data, business operations, pricing, discounts or rebates, disclosed by Buyer to The Seller, whether disclosed orally or disclosed or accessed in written, electronic, or other form or media, and whether or not marked, designated or otherwise identified as “confidential,” in connection with the Order is confidential, solely for the use of performing the Order and may not be disclosed or copied unless authorized by Buyer in writing. Upon Buyer’s request, The Seller shall promptly return all documents and other materials received from Buyer. Buyer shall be entitled to injunctive relief for any violation of this Section. This Section shall not apply to information that is: (a) in the public domain; (b) rightfully and legally known to the Seller at the time of disclosure; or (c) rightfully and legally obtained by the Seller on a non-confidential basis from a third party.</p>`,
    },
    {
      termsHeader: 'Dispute Resolution',
      termsDescription: `<p>i) In the event of any difference or dispute between the Parties occurring from or arising out of this order including any question regarding existence, validity or termination of the contract, Parties shall attempt at resolving the same by mutual agreement within a period of seven days from the date such difference or dispute occurs.</p>
<p>ii) Any difference or dispute remaining unresolved shall be referred to and finally resolved by the arbitration in accordance with the Arbitration and Conciliation Act, 1996 (as amended to date).</p>
<p>iii) The Arbitral Tribunal shall comprise of a sole arbitrator to be appointed by Buyer. The arbitration shall be held in Chennai. The language to be used in the arbitration shall be English.</p>
<p>iv) This contract is subject to and shall be governed by the laws of India. Courts in Chennai shall have exclusive jurisdiction for any applications/ petitions in relation to the arbitral proceedings.</p>`,
    },
    {
      termsHeader: 'Limitation of Liability',
      termsDescription: `<p>Notwithstanding anything contained in this order, its appendices or orders to the contrary, with respect to any and all claims arising out of the performance or non-performance of obligations under this order or Work Orders, whether arising in contract, tort, warranty, strict liability or otherwise, The Seller’s liability shall not exceed in the aggregate 100% of the Work Order value.</p>`,
    },
    {
      termsHeader: 'Consequential Losses',
      termsDescription: `<p>Neither party shall be in no event liable to the other party for the loss of profit, loss of revenues, loss of use, loss of production, costs of capital or costs connected with interruption of operation, loss of anticipated savings or for any special, indirect or consequential damage or loss of any nature whatsoever.</p>`,
    },
    {
      termsHeader: 'Termination/ Cancellation of Order',
      termsDescription: `<p>i) Buyer may terminate or cancel this Order, in whole or in part, for any reason upon thirty (30) days’ prior written notice to The Seller. In addition to any remedies provided herein, Buyer may terminate this Order with immediate effect, either before or after acceptance of Goods if the The Seller has breached any of the Terms herein.</p>
<p>ii) If the The Seller becomes insolvent, commences or has commenced by it or against it bankruptcy proceedings, receivership, reorganization or assignment for the benefit of creditors, then the Buyer may terminate this Order.</p>
<p>iii) If the Buyer terminates the Order for any reason, The Seller’s sole and exclusive remedy is payment for the Goods received and accepted by the Buyer prior to the termination. However, such remedy of the The Seller is subject to Buyer not raising any deficiency in performance of the obligations of the Seller under this Order.</p>`,
    },
    {
      termsHeader: 'Correspondence with Buyer',
      termsDescription: `<p>All correspondence / transaction with Buyer should mention Buyer’s Work Order number and the name of the Work Order issuing department and the concerned person.</p>`,
    },
    {
      termsHeader: 'Notices',
      termsDescription: `<p>All notices, communications, references and complaints issued or made by the Seller/Supplier or the buyer, inter se concerning the supplies and the Work Order shall be in writing and sent to the above address and on the email address of the designated personnel of the Parties.</p>`,
    },
    {
      termsHeader: 'Scanned Copy',
      termsDescription: `<p>Scanned transmissions (includes signed/unsigned copy received via any electronic or any other communication or hand delivery mode) of this document shall be considered as an original of the document, and shall have the same effect and force as signed hard-copy originals of the document. It shall be binding and legally enforceable.</p>`,
    },
  ],
};

/** Long WO face Terms + Annexure-I (Commercial) — SugarCRM Work Order master */
export const LONG_WO_LETTERHEAD_DEFAULTS = {
  title: 'Long WO',
  letterheadHeader: '<p style="text-align:center;"><strong>WORK ORDER</strong></p>',
  terms: [
    {
      termsHeader: 'Scope of work',
      termsDescription: '<p>$aos_invoices_scope_c</p>',
    },
    {
      termsHeader: 'Supply &amp; Work Schedule',
      termsDescription: '<p>$aos_invoices_completion_schedule_c</p>',
    },
    {
      termsHeader: 'Payment Terms',
      termsDescription: '<p>$aos_invoices_payment_terms_c</p>',
    },
    {
      termsHeader: 'Notes',
      termsDescription: '<p>$aos_invoices_notes_c</p>',
    },
    {
      termsHeader: 'Annexures',
      termsDescription: `<p><strong>Annexure I:</strong> Commercial Terms &amp; Conditions</p>
<p><strong>Annexure II:</strong> General Terms &amp; Conditions for Working at Site</p>
<p><strong>Annexure III:</strong> Scope of Work (as applicable)</p>`,
    },
  ],
  annexure: [
    {
      termsHeader: 'Parties',
      termsDescription: `<p>This Work Order is issued by <strong>M/s [Company Name]</strong> hereinafter referred to as the Buyer to <strong>M/s [Vendor Name]</strong> hereinafter referred to as the Seller or the Vendor. The Buyer &amp; the Vendor will be referred to collectively as Parties to this contract.</p>
<p>This Work Order shall constitute the contract (“order”)</p>`,
    },
    {
      termsHeader: 'Acceptance of Order',
      termsDescription: `<p>This Order will be deemed accepted by the Vendor upon the first of the following to occur: (a) Vendor making, signing, or delivering to the Buyer any letter, form, or other writing or instrument acknowledging acceptance; (b) any performance by the Vendor under the Order; or (c) the passage of two (2) days after Vendor’s receipt of the Order without written notice to the Buyer that Vendor does not accept. This Order, together with any documents incorporated herein by reference, constitutes the sole and entire agreement of the parties with respect to the Order and supersedes all prior or contemporaneous understandings, agreements, negotiations, representations, warranties, and communications; both written and oral, with respect to the subject matter of the Order, unless a separate overriding written contract has been entered into and signed by the parties. The Order expressly limits The Vendor’s acceptance of the terms of the Order. These Terms expressly exclude any of The Vendor’s terms and conditions of sale or any other document issued by The Vendor in connection with this Order.</p>`,
    },
    {
      termsHeader: 'Effective date and term',
      termsDescription: `<p>This Order will come into effect from the date of acceptance or deemed acceptance of this Order. This Order shall be in force till such time that the obligations of the Parties under this Order are fulfilled. The validity of this Order may be extended by the Parties on such terms as may be mutually agreed upon by and between the Parties in writing.</p>`,
    },
    {
      termsHeader: 'Site Mobilization',
      termsDescription: `<p>The site is to be mobilized within 2 days from the date of work order acceptance and Advance payment receipt.</p>`,
    },
    {
      termsHeader: 'Inspection',
      termsDescription: `<p>The contractor shall offer the stage inspection and final Inspection of the work under execution to the buyer or the third-party inspection agency appointed by the buyer. The contractor shall attend and close all observations and get a clear inspection report from the authorities doing the inspection from time to time.</p>`,
    },
    {
      termsHeader: 'Work completion Schedule',
      termsDescription: `<p>The entire work as per the scope document Annexure-III shall be completed within 15 days from the date of site mobilization. The Vendor shall mobilize labour, machineries, and materials immediately to the site from the effective date of this Work order. Time is the essence of the contract and must be strictly adhered to.</p>
<p>If the Vendor fails to satisfactorily complete the work or any part thereof in time, as stipulated under this contract, the buyer may at its sole discretion:</p>
<p>i) Treat the Work Order as cancelled at any time and recover any loss or damage from the contractor, and/or</p>
<p>ii) Engage labour/sub-contractor from other sources, to satisfactorily complete the work at Contractor’s cost and risk, in which case, the contractor shall be liable to pay the buyer, not only the difference between the price at which such labour/sub-contractors have been engaged, but also any other loss or damage the buyer may suffer.</p>
<p>In addition to the above terms, the contractor agrees to be responsible for any consequence (including loss of business) arising from late completion of work or non-completion of work and will indemnify the buyer within 2 days of demand, of all damages suffered by it. Upon failure of the contractor to make good the losses suffered by the buyer within 2 days of demand, the contractor would be liable to pay the damages at an interest of 18% compounded monthly till its actual realization.</p>`,
    },
    {
      termsHeader: 'Price and Set-Off',
      termsDescription: `<p>The price of the works is the price stated on the face of this Order (the “<strong>Price</strong>”). The Vendor shall invoice the Buyer for the Order as stated in the Payment Terms on the face of this Order. The price shall remain fixed and firm till the complete execution of this order without any escalation.</p>`,
    },
    {
      termsHeader: 'Confidential Information',
      termsDescription: `<p>All non-public, confidential, or proprietary information of the Buyer, including, but not limited to, specifications, samples, patterns, designs, plans, drawings, documents, data, business operations, pricing, discounts, or rebates, disclosed by Buyer to The Vendor, whether disclosed orally or disclosed or accessed in written, electronic, or other form or media, and whether or not marked, designated or otherwise identified as “confidential,” in connection with the Order is confidential, solely for the use of performing the Order and may not be disclosed or copied unless authorized by Buyer in writing. Upon Buyer’s request, The Vendor shall promptly return all documents and other materials received from Buyer. Buyer shall be entitled to injunctive relief for any violation of this Section. This Section shall not apply to information that is: (a) in the public domain; (b) rightfully and legally known to the Vendor at the time of disclosure; or (c) rightfully and legally obtained by the Vendor on a non-confidential basis from a third party.</p>`,
    },
    {
      termsHeader: 'Dispute Resolution',
      termsDescription: `<p>i) In the event of any difference or dispute between the Parties occurring from or arising out of this order including any question regarding the existence, validity or termination of the contract, Parties shall attempt at resolving the same by mutual agreement within a period of seven days from the date such difference or dispute occurs.</p>
<p>ii) Any difference or dispute remaining unresolved shall be referred to and finally resolved by the arbitration in accordance with the Arbitration and Conciliation Act, 1996 (as amended to date).</p>
<p>iii) The Arbitral Tribunal shall comprise of a sole arbitrator to be appointed by Buyer. The arbitration shall be held in Chennai. The language to be used in the arbitration shall be English.</p>
<p>iv) This contract is subject to and shall be governed by the laws of India. Courts in Chennai shall have exclusive jurisdiction for any applications/ petitions in relation to the arbitral proceedings.</p>`,
    },
    {
      termsHeader: 'Limitation of Liability',
      termsDescription: `<p>Notwithstanding anything contained in this order, its appendices or orders to the contrary, with respect to any and all claims arising out of the performance or non-performance of obligations under this order or Work Orders, whether arising in contract, tort, warranty, strict liability or otherwise, The Vendor’s liability shall not exceed in the aggregate 100% of the Work Order value.</p>`,
    },
    {
      termsHeader: 'Consequential Losses',
      termsDescription: `<p>Neither party shall be in no event liable to the other party for the loss of profit, loss of revenues, loss of use, loss of production, costs of capital or costs connected with interruption of operation, loss of anticipated savings or for any special, indirect or consequential damage or loss of any nature whatsoever.</p>`,
    },
    {
      termsHeader: 'Indemnification',
      termsDescription: `<p>Without limiting any other remedy of the Buyer, the Vendor shall at its own expense, defend, indemnify and hold harmless the Buyer’s parent company, its subsidiaries, affiliates, successors or assigns and its directors, officers, employees, agents and customers (Indemnitee’s) from and against any and all loss, cost, expense, damages, claims, proceedings, actions, judgment, interest, penalty, cost or expense, demands or liability, including legal counsel fees and expenses and the cost of enforcing any right to indemnification, incurred or suffered by the Buyer resulting from bodily injury, sickness, disease, or death of persons, or damage to property arising out of or in connection with the Vendor’s performance of this order including but not limited to:</p>
<p>i) non-compliance with the Buyer’s specification requirements;</p>
<p>ii) negligence or wilful misconduct of the Vendor, its employees, contractors, suppliers or agents;</p>
<p>iii) defects in the workmanship, materials or design of the goods supplied, work performed by the Vendor;</p>
<p>iv) failure to comply with central, state or local laws; or</p>
<p>v) breach of this order.</p>
<p>vi) infringes or misappropriates the patent, copyright, trade secret or other intellectual property right of any third party.</p>
<p>The Vendor shall not enter into any settlement without Buyer’s or Indemnitee’s aforesaid prior written consent.</p>`,
    },
    {
      termsHeader: 'Patent',
      termsDescription: `<p>The Vendor shall indemnify and keep the Buyer, its Director, Employee, and respective customers indemnified against all losses or damages arising from any infringement of any patent in respect of any goods processed and supplied by the Vendor against this order. In addition, all litigation costs, if any, suffered by the Buyer as a result of any patent suit shall be reimbursed to the Buyer by the Vendor forthwith.</p>`,
    },
    {
      termsHeader: 'Termination/ Cancellation of Order',
      termsDescription: `<p>i) Buyer may terminate or cancel this Order, in whole or in part, for any reason upon thirty (30) days’ prior written notice to The Vendor. In addition to any remedies provided herein, Buyer may terminate this Order with immediate effect, either before or after acceptance of Goods if The Vendor has breached any of the Terms herein.</p>
<p>ii) If the Vendor becomes insolvent, commences or has commenced by it or against it bankruptcy proceedings, receivership, reorganization or assignment for the benefit of creditors, then the Buyer may terminate this Order.</p>
<p>iii) If the Buyer terminates the Order for any reason, The Vendor's sole and exclusive remedy is payment for the Goods received and accepted by the Buyer prior to the termination. However, such remedy of the The Vendor is subject to Buyer not raising any deficiency in performance of the obligations of the Vendor under this Order.</p>`,
    },
    {
      termsHeader: 'Compliance with Applicable Law',
      termsDescription: `<p>The Vendor warrants and represents to Buyer that it is in compliance with and shall remain in compliance during performance of this Order and ensure that its employees, agents, contractors and subcontractors (the “Personnel”) comply with all applicable laws, regulations and ordinances in force in India. The Vendor has and shall maintain in effect all the licenses, permissions, authorizations, consents and permits required by law to carry out its obligations under the Order. The Vendor assumes all responsibility for shipments of Goods requiring any government clearance. If The Vendor fails to comply with the laws, orders, rules, ordinances and regulations and as a result Buyer is fined, The Vendor agrees to pay the fine and costs incident thereto or reimburse Buyer for payment. To the extent that The Vendor’s Personnel are required to enter onto Buyer’s site or property, The Vendor shall ensure that Personnel comply with Buyer’s health, safety and environmental policies and standards.</p>`,
    },
    {
      termsHeader: 'Correspondence with Buyer',
      termsDescription: `<p>All correspondence/transactions with Buyer should mention Buyer’s Work Order number and the name of the Work Order issuing department and the concerned person.</p>`,
    },
    {
      termsHeader: 'Notices',
      termsDescription: `<p>All notices, communications, references and complaints issued or made by the Vendor/Supplier or the Buyer, inter se concerning the supplies and the Work Order shall be in writing and sent to the above address and on the email address of the designated personnel of the Parties.</p>`,
    },
    {
      termsHeader: 'Scanned Copy',
      termsDescription: `<p>Scanned transmissions (includes signed/unsigned copy received via any electronic or any other communication or hand delivery mode) of this document shall be considered as an original of the document, and shall have the same effect and force as signed hard-copy originals of the document. It shall be binding and legally enforceable.</p>`,
    },
    {
      termsHeader: 'Miscellaneous',
      termsDescription: `<p>The Vendor shall not assign, transfer, delegate or subcontract any of its rights or obligations under the Order without Buyer’s prior written consent. Any purported assignment or delegation in violation of this Section shall be null and void. No assignment shall relieve the The Vendor of any of its obligations hereunder. No modification, alteration or amendment of the Order shall be binding unless agreed to in writing and signed by Buyer. The Buyer reserves the right to amend order or any part thereof without assigning any reason. No waiver by any party of any of the provisions of the Order shall be effective unless explicitly set forth in writing and signed by the party so waiving. No failure to exercise, or delay in exercising, any rights, remedy, power or privilege arising from the Order by Buyer shall operate or be construed as a waiver thereof, nor shall any single or partial exercise of any right, remedy, or privilege hereunder preclude any other exercise of any additional right, remedy, or privilege.</p>`,
    },
  ],
};

/**
 * Default Annexure-II rows for Long WO (General Terms & Conditions for Working at Site).
 * Loaded into Create WO when Annexure II is empty.
 */
export const LONG_WO_ANNEXURE_II_DEFAULTS = [
  {
    title: 'ANNEXURE-II',
    header: 'General EHS requirements',
    description: `<p>The Vendor is responsible for ensuring that the Vendor’s personnel, its subcontractor’s personnel, the contract labour deployed by the Vendor or the visitors to site are fully aware of and comply with the EHS requirements during all the time during the execution of work as per the contract or while on site including the procedures to be followed in case of emergency.</p>
<p>The Vendor is required to take an all risk insurance cover for its workforce &amp; machines deployed at site for the installation of PEB from a reputed insurance company and submit a copy to the Buyer’s site representative before starting the work at site.</p>
<p>The Buyer reserves the right to verify that the Vendor meets the EHS requirements without any deviation.</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Manpower',
    description: `<p>The Vendor shall provide competent and suitable personnel for the work to be carried out at site as per the scope of this Work Order. The Vendor’s personnel admitted to site must conduct themselves in an orderly and safe manner and conform at all times to the EHS requirements. Fighting, engaging in horse play, being under the influence of or possessing alcohol or drugs, stealing, immoral or otherwise undesirable conduct is not permitted and shall not be tolerated at site. Upon knowledge of such conduct, the Buyer may immediately exclude concerned person from site.</p>
<p>All Vendor’s personnel shall be in possession of the necessary licenses and certificates that are required for the execution of the works as per the scope of the Work Order. The Vendor shall maintain records of training and competency certificates of the personnel deputed at site. The Vendor shall ensure that the personnel working at Site shall attend the Site Specific EHS Induction.</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Use of Personal Protective Equipment (PPE)',
    description: `<p>The Vendor shall ensure at its own cost that each member of the team is provided with the correct Personal Protective Equipment or clothing for the works to be carried out, including but not limited to safety shoes, safety helmets, long pants, long sleeved shirt, gloves, aprons, high visibility clothing, masks, safety glasses, goggles, ear plugs, double lanyard safety harnesses, etc., as may be required by risk assessment. All PPE used shall at all times be in accordance with recognized standards and the Law. The Vendor shall ensure that all PPE have been properly assessed for suitability, are maintained and stored properly and are provided with instructions on safe use. The Vendor shall monitor correct use of PPE by their Personnel.</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Zero tolerance to deviation',
    description: `<p>The Buyer adopts a Zero Tolerance to Deviation Policy in all high-risk activities, whose principles are:</p>
<ul>
<li>Deviation to any EHS requirement cannot be tolerated;</li>
<li>In case of a deviation that could result in a severe accident, the concerned activity must be stopped immediately, an investigation must be conducted and corrective/preventive measures must be implemented;</li>
<li>Individual disciplinary measures may be applied where it is found through investigation that an EHS requirement has been breached, based on the “three-strike rule” (verbal warning, written warning and exclusion from Site). Deliberate breaches of requirements in relation to High-Risk Activities may require stronger and quicker disciplinary measures.</li>
</ul>
<p>The Vendor is responsible for applying those principles to the Contract Works and must ensure that their personnel understand them.</p>
<p>The Buyer remains entitled to request the Vendor to remove from Site any person and/or plant, materials, tools or equipment that is not conforming to the EHS Requirements.</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'EHS Reporting',
    description: `<p>The Vendor shall immediately notify the Buyer of any environmental incident, injury, illness, near-miss, unsafe condition or practice and any loss or damage to the Buyer property, environment including incidents related to the Contractor Personnel.</p>
<p>Containment actions shall be taken immediately. Preliminary investigation report assessing the potential root causes shall be submitted to the Buyer within 1 day. Final Root Cause analysis, corrective action and preventative actions shall be submitted to the Buyer by the Vendor within 5 days except if defined differently by the Buyer. This report shall be done using the Buyer’s forms unless otherwise agreed by the Buyer in writing.</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Emergency Response Procedure',
    description: `<p>The Vendor shall ensure that all its personnel working at site are made aware of the Site-Specific Emergency Response Procedures and Evacuation Muster Points. The Vendor shall contribute to the organization of the overall emergency arrangements, to ensure suitable evacuation and roll call of Vendor’s personnel in case of evacuation. In any case, the Vendor remains fully responsible for the management of their personnel (and their own Contractor Personnel) and particularly during site emergencies and/or site evacuations. Particularly the Vendor must have a system in place to account for their personnel during a site emergency/site evacuation. The Buyer remains responsible for the availability of relevant emergency infrastructure and facilities (emergency exits, escape lighting, fire extinguisher, Fire Hydrant… etc.).</p>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Standard Safety Rules',
    description: `<ul>
<li>Smoking within the premises of the solar power installation (Hereinafter referred to as ‘Site’) is strictly prohibited. No one shall bring the matchbox or a lighter inside the site premises.</li>
<li>Cell phone usage and listening to music while working within the site is strictly prohibited.</li>
<li>The Vendor’s employees at site must not report to work in intoxicated condition. Drinking of alcohol within the site premises is strictly prohibited</li>
<li>The Vendor/Vendor’s supervisor must report to the representative of the Buyer at site/site incharge/project manager, daily before starting the work in order to (a) establish the scope of the day’s work and (b) to obtain necessary work permits</li>
<li>Any work beyond the normal working hours (6 PM onwards) needs the permission from the concerned site personnel. Extension of working hours shall be planned well in advance and with adequate arrangements of flood lights.</li>
<li>In case of emergency, the Vendor/Vendor’s workers should assemble at the nearest safe assembly point and wait for further instructions.</li>
</ul>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'Statutory Requirements',
    description: `<p>The Vendor shall comply with the statutory requirements under following acts and maintain proper records for its personnel deployed at site.</p>
<ul>
<li>Labour license registration</li>
<li>Insurance of labour, tools and tackles</li>
<li>Minimum wages</li>
<li>Provident fund</li>
<li>ESI</li>
<li>Child labour</li>
<li>Contract Labour Regulation &amp; Abolition Act, 1970</li>
</ul>`,
    images: [],
    comments: '',
  },
  {
    title: 'ANNEXURE-II',
    header: 'General terms',
    description: `<ul>
<li>The Vendor shall cart away all debris, refuse etc arising from the work at site and dispose the same as directed by the Buyer at no extra cost. The work front should always be clean and proper housekeeping to be done by the Vendor</li>
<li>As a standard practice, the Buyer do not entertain any claims towards idle charges unless it is proven explicitly and with adequate supporting documents/evidences that the reasons for idling are directly attributable to the Buyer.</li>
<li>The Vendor is responsible for maintaining proper coordination and harmony with the other agencies working at site. The work of the other agencies should not be hampered due to any actions of the Vendor.</li>
</ul>`,
    images: [],
    comments: '',
  },
];
