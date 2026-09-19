type BaseEmailProps = {
  jobId: string
  dashboardUrl: string
}

type OutreachEmailProps = BaseEmailProps & {
  jobDescription: string
  vendorNames: string[]
}

type VendorReplyEmailProps = BaseEmailProps & {
  jobDescription: string
  vendorName: string
  statusHeadline: string
  summary: string
  quoteAmount?: string | null
  followupQuestion?: string | null
}

type ExecutiveSummaryEmailProps = BaseEmailProps & {
  jobDescription: string
  summaryText: string
}

type DecisionEmailProps = BaseEmailProps & {
  jobDescription: string
  question: string
  context: string
  options?: string[]
}

type AcknowledgmentEmailProps = BaseEmailProps & {
  taskDescription: string
}

const fontSerif =
  "'Instrument Serif', Georgia, Cambria, 'Times New Roman', serif"
const fontMono =
  "'Geist Mono', 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
const fontSans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const renderHeader = (jobId: string) => `
  <div style="padding-bottom: 24px; border-bottom: 1px solid #eaeaea; margin-bottom: 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" style="vertical-align: middle;">
          <div style="font-family: ${fontMono}; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #111111;">
            <span style="color: #16a34a; font-size: 14px; margin-right: 6px;">●</span>RELAY
          </div>
        </td>
        <td align="right" style="vertical-align: middle;">
          <span style="font-family: ${fontMono}; font-size: 11px; color: #888888; background: #f3f3f3; padding: 4px 8px; border-radius: 3px; border: 1px solid #e5e5e5;">
            AGENT #${jobId.slice(-4).toUpperCase()}
          </span>
        </td>
      </tr>
    </table>
  </div>
`

const renderFooter = (dashboardUrl: string) => `
  <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #eaeaea;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left">
          <p style="margin: 0; font-family: ${fontMono}; font-size: 11px; color: #888888; letter-spacing: 0.04em;">
            RELAY AUTONOMOUS SOURCING
          </p>
        </td>
        <td align="right">
          <a href="${dashboardUrl}" style="font-family: ${fontMono}; font-size: 11px; color: #111111; text-decoration: underline;">
            OPEN DASHBOARD →
          </a>
        </td>
      </tr>
    </table>
  </div>
`

const wrapEmail = (
  title: string,
  bodyContent: string,
  jobId: string,
  dashboardUrl: string,
) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" type="text/css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: ${fontSans}; color: #111111;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f7f7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <tr>
            <td>
              ${renderHeader(jobId)}
              ${bodyContent}
              ${renderFooter(dashboardUrl)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

export const renderAcknowledgmentEmail = ({
  jobId,
  dashboardUrl,
  taskDescription,
}: AcknowledgmentEmailProps): string => {
  const body = `
    <div style="margin-bottom: 24px;">
      <span style="font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 3px;">
        REQUEST RECEIVED
      </span>
      <h2 style="font-family: ${fontSerif}; font-size: 26px; font-weight: 400; line-height: 1.25; margin: 16px 0 8px 0; color: #111111;">
        Relay is on the job
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #555555;">
        We received your sourcing request. Our agent is analyzing specifications, identifying verified vendors, and preparing outreach.
      </p>
      <div style="background: #fafafa; border-left: 3px solid #111111; padding: 12px 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; font-style: italic; color: #222222; line-height: 1.5;">
          "${taskDescription}"
        </p>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #111111; color: #ffffff; font-family: ${fontMono}; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
        TRACK LIVE PROGRESS →
      </a>
    </div>
  `

  return wrapEmail(
    `Relay: Sourcing request received`,
    body,
    jobId,
    dashboardUrl,
  )
}

export const renderOutreachEmail = ({
  jobId,
  dashboardUrl,
  jobDescription,
  vendorNames,
}: OutreachEmailProps): string => {
  const vendorListHtml = vendorNames
    .map(
      name => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px 12px; font-family: ${fontMono}; font-size: 12px; color: #111111;">
          ${name}
        </td>
        <td style="padding: 10px 12px; font-family: ${fontMono}; font-size: 11px; color: #16a34a; text-align: right;">
          DISPATCHED
        </td>
      </tr>
    `,
    )
    .join('')

  const body = `
    <div style="margin-bottom: 24px;">
      <span style="font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 3px;">
        OUTREACH ACTIVE
      </span>
      <h2 style="font-family: ${fontSerif}; font-size: 26px; font-weight: 400; line-height: 1.25; margin: 16px 0 8px 0; color: #111111;">
        Dispatched inquiries to ${vendorNames.length} vendors
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #555555;">
        Relay initialized autonomous outreach for your sourcing request:
      </p>
      <div style="background: #fafafa; border-left: 3px solid #111111; padding: 12px 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; font-style: italic; color: #222222; line-height: 1.5;">
          "${jobDescription}"
        </p>
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #eaeaea; border-radius: 4px; margin-bottom: 28px;">
      <thead>
        <tr style="background: #fafafa; border-bottom: 1px solid #eaeaea;">
          <th style="padding: 8px 12px; font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; text-align: left; color: #666666;">
            VENDOR
          </th>
          <th style="padding: 8px 12px; font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; text-align: right; color: #666666;">
            STATUS
          </th>
        </tr>
      </thead>
      <tbody>
        ${vendorListHtml}
      </tbody>
    </table>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #111111; color: #ffffff; font-family: ${fontMono}; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
        VIEW LIVE PROGRESS →
      </a>
    </div>
  `

  return wrapEmail(
    `Relay: We reached out to ${vendorNames.length} vendors`,
    body,
    jobId,
    dashboardUrl,
  )
}

export const renderVendorReplyEmail = ({
  jobId,
  dashboardUrl,
  jobDescription,
  vendorName,
  statusHeadline,
  summary,
  quoteAmount,
  followupQuestion,
}: VendorReplyEmailProps): string => {
  const isQuote = Boolean(quoteAmount)
  const badgeColor = isQuote
    ? 'background: #dcfce7; color: #15803d;'
    : 'background: #f3f4f6; color: #4b5563;'

  const body = `
    <div style="margin-bottom: 24px;">
      <span style="font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; ${badgeColor}">
        ${statusHeadline}
      </span>
      <h2 style="font-family: ${fontSerif}; font-size: 26px; font-weight: 400; line-height: 1.25; margin: 16px 0 8px 0; color: #111111;">
        Response from ${vendorName}
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #666666;">
        Task: "${jobDescription}"
      </p>
    </div>

    ${
      quoteAmount
        ? `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
        <div style="font-family: ${fontMono}; font-size: 11px; letter-spacing: 0.06em; color: #166534; margin-bottom: 4px;">
          QUOTE AMOUNT
        </div>
        <div style="font-family: ${fontMono}; font-size: 24px; font-weight: 700; color: #15803d;">
          ${quoteAmount}
        </div>
      </div>
    `
        : ''
    }

    <div style="background: #fafafa; border: 1px solid #eaeaea; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
      <div style="font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; color: #666666; margin-bottom: 8px;">
        SUMMARY
      </div>
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #222222;">
        ${summary}
      </p>
    </div>

    ${
      followupQuestion
        ? `
      <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <div style="font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; color: #1e40af; margin-bottom: 6px;">
          AUTONOMOUS FOLLOW-UP SENT
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1e3a8a;">
          "${followupQuestion}"
        </p>
      </div>
    `
        : ''
    }

    <div style="text-align: center; margin-top: 24px; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #111111; color: #ffffff; font-family: ${fontMono}; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
        VIEW CONVERSATION →
      </a>
    </div>
  `

  return wrapEmail(
    `Relay: Response from ${vendorName} (${statusHeadline})`,
    body,
    jobId,
    dashboardUrl,
  )
}

export const renderExecutiveSummaryEmail = ({
  jobId,
  dashboardUrl,
  jobDescription,
  summaryText,
}: ExecutiveSummaryEmailProps): string => {
  const formattedSummary = summaryText
    .split('\n\n')
    .map(para => {
      const trimmed = para.trim()
      if (!trimmed) return ''
      if (
        trimmed.startsWith('#') ||
        (trimmed.startsWith('**') && trimmed.endsWith('**'))
      ) {
        return `<h3 style="font-family: ${fontSerif}; font-size: 18px; font-weight: 400; margin: 18px 0 8px 0; color: #111111;">${trimmed.replace(/^[#*]+\s*/, '').replace(/\*+$/, '')}</h3>`
      }
      return `<p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #333333;">${trimmed}</p>`
    })
    .join('')

  const body = `
    <div style="margin-bottom: 24px;">
      <span style="font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 3px;">
        REPORT COMPILED
      </span>
      <h2 style="font-family: ${fontSerif}; font-size: 26px; font-weight: 400; line-height: 1.25; margin: 16px 0 8px 0; color: #111111;">
        Final Sourcing Report
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #666666;">
        Task: "${jobDescription}"
      </p>
    </div>

    <div style="background: #ffffff; border: 1px solid #eaeaea; border-radius: 4px; padding: 20px; margin-bottom: 28px;">
      ${formattedSummary}
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #111111; color: #ffffff; font-family: ${fontMono}; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
        OPEN FULL SOURCING REPORT →
      </a>
    </div>
  `

  return wrapEmail(
    `Relay: Sourcing report for ${jobDescription.slice(0, 40)}`,
    body,
    jobId,
    dashboardUrl,
  )
}

export const renderDecisionRequiredEmail = ({
  jobId,
  dashboardUrl,
  jobDescription,
  question,
  context,
  options,
}: DecisionEmailProps): string => {
  const optionsHtml =
    options && options.length > 0
      ? `
      <div style="margin: 20px 0;">
        <div style="font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; color: #666666; margin-bottom: 8px;">
          AVAILABLE OPTIONS
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${options
            .map(
              (opt, idx) => `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #111111;">
                <span style="font-family: ${fontMono}; font-weight: 600; color: #111111; margin-right: 8px;">[${idx + 1}]</span>
                ${opt}
              </td>
            </tr>
          `,
            )
            .join('')}
        </table>
      </div>
    `
      : ''

  const body = `
    <div style="margin-bottom: 24px;">
      <span style="font-family: ${fontMono}; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 3px;">
        ACTION REQUIRED
      </span>
      <h2 style="font-family: ${fontSerif}; font-size: 26px; font-weight: 400; line-height: 1.25; margin: 16px 0 8px 0; color: #111111;">
        Relay needs your decision
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #666666;">
        Task: "${jobDescription}"
      </p>
    </div>

    <div style="background: #fafafa; border: 1px solid #111111; border-radius: 4px; padding: 18px; margin-bottom: 20px;">
      <div style="font-family: ${fontMono}; font-size: 10px; letter-spacing: 0.06em; color: #666666; margin-bottom: 6px;">
        QUESTION
      </div>
      <p style="margin: 0; font-family: ${fontSerif}; font-size: 20px; font-weight: 400; color: #111111; line-height: 1.35;">
        ${question}
      </p>
    </div>

    <div style="margin-bottom: 20px;">
      <p style="margin: 0; font-size: 13px; color: #555555; line-height: 1.5;">
        ${context}
      </p>
    </div>

    ${optionsHtml}

    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 14px; margin-bottom: 28px;">
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong>How to reply:</strong> Simply reply directly to this email with your answer, or click below to resolve on the dashboard.
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #111111; color: #ffffff; font-family: ${fontMono}; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
        RESOLVE ON DASHBOARD →
      </a>
    </div>
  `

  return wrapEmail(
    `[Action Required] Relay needs your input`,
    body,
    jobId,
    dashboardUrl,
  )
}
