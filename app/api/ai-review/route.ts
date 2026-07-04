import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { bountyId } = await req.json();

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
    }

    // 1. Verify Bounty
    const { data: bounty, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", bountyId)
      .single();

    if (bountyError || !bounty) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    // 2. Fetch Submissions
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("bounty_id", bountyId);

    if (subError || !submissions || submissions.length === 0) {
      return NextResponse.json({ error: "No submissions found" }, { status: 400 });
    }

    // 3. Prepare Gemini Prompt
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptParts: any[] = [
      {
        text: `You are an expert judge for a bounty contest. 
      Bounty Title: ${bounty.title}
      Bounty Description: ${bounty.description}
      
      Please analyze the following submissions and select the top 3 best ones based on quality, relevance, and creativity.
      If a submission has images, consider them in your evaluation.
      ` }
    ];

    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      promptParts.push({ text: `\n--- Submission ${i + 1} (ID: ${s.id}) ---\nContent: ${s.content}\n` });

      // Extract and attach images
      const imgRegex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = imgRegex.exec(s.content)) !== null) {
        const url = match[1];
        try {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

            // Only attach if valid image type
            if (mimeType.startsWith("image/")) {
              promptParts.push({
                inlineData: {
                  data: base64,
                  mimeType: mimeType,
                },
              });
            }
          }
        } catch (e) {
          console.error(`Failed to fetch image for submission ${s.id}:`, url);
        }
      }
    }

    promptParts.push({
      text: `
      \n\nInstructions:
      Output a single JSON block strictly in this exact format. Do NOT provide any conversational text, thinking process, or preamble. Just the JSON:
      
      \`\`\`json
      {
        "top_submissions": [
          { "id": "submission_id", "feedback": "Provide 1-2 short sentences of punchy, concise feedback explaining why this was chosen or flagged." }
        ]
      }
      \`\`\`
    `});

    // 4. Stream Response
    const result = await model.generateContentStream(promptParts);

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            controller.enqueue(new TextEncoder().encode(text));
          }

          // 5. Parse JSON and Update DB
          const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/) || fullText.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            // Clean up any potential markdown artifacts if match was loose
            const cleanJsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();

            const parsed = JSON.parse(cleanJsonStr);

            if (parsed.top_submissions) {
              // Reset previous selections
              await supabase
                .from("submissions")
                .update({ is_ai_selected: false, ai_feedback: null })
                .eq("bounty_id", bountyId);

              // Update new selections
              for (const sub of parsed.top_submissions) {
                await supabase
                  .from("submissions")
                  .update({ is_ai_selected: true, ai_feedback: sub.feedback })
                  .eq("id", sub.id);
              }
            }
          }
        } catch (e) {
          console.error("Stream processing error:", e);
          controller.enqueue(new TextEncoder().encode("\n\n[Error processing AI results]"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
