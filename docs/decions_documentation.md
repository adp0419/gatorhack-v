Decisions
Turn text and images into decisions your application can use, 10x faster than the Responses API.

The Decisions API is now generally available. Review what’s new since the public beta.

The Decisions API evaluates text, images, and JSON and returns typed answers about 10x faster than the Responses API. Get the probability that a condition is true, a choice from a fixed set, or a score against a rubric. Use those answers to classify content, route requests, and prioritize work in your application.

Try the Decisions API in the Playground to experiment with questions and inputs before writing code.

Send requests to POST /v1/decisions using gpt-6-luna, the only currently supported model.

What’s new

Since the public beta launched, the Decisions API has added these capabilities:

Prompt caching. Reuse shared input across requests and receive cache discounts.
Images in question instructions. Give each question its own images to compare against shared evidence.
JSON input. Pass structured data directly with an input_json content part.
More questions per request. Ask up to 400 questions per request, up from 200 during the public beta.
Hosted image inputs. Pass publicly accessible HTTP or HTTPS image URLs as well as inline base64 data URLs.
Conversation history. Evaluate messages alongside function calls, custom tool calls, and their outputs.
Organization usage reporting. Track token usage and request counts.
Native GPT-Live integration. Let Live call Decisions directly, or trigger decisions as input or output transcripts arrive.
Private Link. Send Decisions requests over a private connection.
How decisions work

A request has three parts:

Field	Purpose
model	The model that evaluates the request. Currently, only gpt-6-luna is supported.
input	Shared evidence for the questions: a text string or an ordered array of messages, tool calls, and tool outputs.
questions	What to evaluate, including each question’s type, instructions, and any allowed choices or score levels.
The response contains an answers array. Give each question a unique name to identify its answer; the API echoes that name in the response.

Choose a question type

Type	Use it to	Main result
predicate	Check a condition, such as visible damage or passage relevance.	probability: an estimate from 0 to 1 that the condition is true.
choice	Select one option, such as a department or content category.	choice: one of your supplied values.
score	Rate an input against ordered levels, such as issue severity.	score: the probability-weighted average of the level indices.
Both choice and score return probabilities over discrete options. Use choice for categories without an order, such as departments. Use score for ordered levels, such as severity; it takes the probability-weighted average of their numeric indices to produce a score that can fall between levels.

Use Decisions when your application needs one of these answer types. Use Structured Outputs with the Responses API when you need to generate an object that follows your own JSON schema, such as extracted fields or a written explanation, or function calling when you need a model to request a tool call with arguments.

Evaluate a conversation

Pass conversation history in input to evaluate a request in context. Include messages and any function or custom tool calls and outputs in order. Match each tool output to its call with call_id.

The supported content depends on the message role or item type:

Input item	Supported content
User message	Text, images, and JSON
Developer or system message	Input text only; system messages are treated as developer messages
Assistant message	Output text or refusals
Function or custom tool output	Text and images, associated with a matching tool call
Tool calls and outputs provide evidence for your questions. Decisions returns typed answers; your application runs any actions those answers select. Files, audio, and item references aren’t supported. See the create decision reference for accepted input fields.

Evaluate JSON data

Use an input_json content part to pass structured evidence without first converting it to a string. Put the JSON object or array in data, alongside any text or image parts in a user message. Within message content, input_json is supported only for the user role.

For example, send this JSON request body to POST /v1/decisions to evaluate a support ticket against an order record:

{
  "model": "gpt-6-luna",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "Evaluate the ticket using the order evidence."
        },
        {
          "type": "input_json",
          "data": {
            "ticket": { "body": "Please refund the duplicate charge." },
            "order": { "charges": [49, 49] }
          }
        }
      ]
    }
  ],
  "questions": [
    {
      "type": "predicate",
      "name": "duplicate_charge",
      "instructions": "Does the ticket describe a duplicate charge supported by the order?"
    }
  ]
}

JSON keys such as role or image_url inside data are ordinary data: they don’t create messages or fetch images. The answer still uses the selected question type; JSON input doesn’t change the response format.

Check an image for visible damage

Use a predicate question to check a product photo for visible damage. This request combines the image with instructions to look for a crack, tear, or dent.

Dent
Cancellation
Answer relevance

Check an image for visible damage
IMAGE_BASE64="$(base64 < product.png | tr -d '\r\n')"

curl https://api.openai.com/v1/decisions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<JSON
{
  "model": "gpt-6-luna",
  "input": [{
    "role": "user",
    "content": [
      {"type": "input_text", "text": "Inspect the product in this photo."},
      {"type": "input_image", "image_url": "data:image/png;base64,$IMAGE_BASE64"}
    ]
  }],
  "questions": [{
    "type": "predicate",
    "name": "visible_damage",
    "instructions": "Does the product have visible damage, such as a crack, tear, or dent? Ignore shadows and damage to the packaging."
  }]
}
JSON
An illustrative response excerpt:

{
  "answers": [
    {
      "type": "predicate",
      "name": "visible_damage",
      "probability": 0.92
    }
  ]
}

The probability is the model’s estimate that the condition is true. Use it to flag photos for review based on a threshold you choose.

Provide images as inline base64 data URLs or publicly accessible HTTP or HTTPS URLs. This endpoint doesn’t support file_id inputs. Combine input_text and input_image parts in a user message to evaluate images together with instructions or other context.

Include images in question instructions

Put evidence that all questions share in input. To give each question a different image, set its instructions to a nonempty array of input_text and input_image parts. This works for predicate, choice, and score questions. Text-only instructions can remain a string.

For example, send this JSON request body to POST /v1/decisions to compare a candidate against a shared reference. Replace the two example image URLs with publicly accessible images, or use base64 image data URLs:

{
  "model": "gpt-6-luna",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "The shared image is reference image A."
        },
        {
          "type": "input_image",
          "image_url": "https://example.com/reference.jpg"
        }
      ]
    }
  ],
  "questions": [
    {
      "type": "predicate",
      "name": "candidate_matches_reference",
      "instructions": [
        {
          "type": "input_text",
          "text": "Is candidate image B a derivative or variant of reference image A, including recompression or resizing?"
        },
        {
          "type": "input_image",
          "image_url": "https://example.com/candidate.jpg"
        }
      ]
    }
  ]
}

When adding images to question instructions:

Add another question for each candidate image. Each question evaluates its own candidate against the same shared reference.
Supply content parts directly in instructions, without a message wrapper or role.
Question images share the request’s image limits with images in input.
Select from fixed options

A choice question selects one value from the options you provide. Use distinct values and descriptions that explain when each option applies.

Driving
Team routing
Document type

This request routes a customer complaint:

Route a customer complaint
curl https://api.openai.com/v1/decisions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-6-luna",
    "input": "I was charged twice for my order.",
    "questions": [{
      "type": "choice",
      "name": "department",
      "instructions": "Which department should handle this complaint?",
      "choices": [
        {"value": "billing", "description": "Payments, invoices, and refunds."},
        {"value": "technical", "description": "Problems using the product."},
        {"value": "shipping", "description": "Delivery and tracking."},
        {"value": "other", "description": "Requests outside these categories."}
      ]
    }]
  }'
An illustrative response excerpt:

{
  "answers": [
    {
      "type": "choice",
      "name": "department",
      "choice": "billing",
      "probabilities": [
        { "value": "billing", "probability": 0.95 },
        { "value": "technical", "probability": 0.02 },
        { "value": "shipping", "probability": 0.01 },
        { "value": "other", "probability": 0.02 }
      ],
      "confidence": 0.93
    }
  ]
}

The answer’s choice field contains a supplied value, here "billing". It also includes a probabilities array for the options and a confidence field. See Interpret the answers for guidance on setting thresholds.

Include a fallback option such as "other" when your categories don’t cover every possible input. Your application can send that result to a general review queue.

Score against a rubric

A score question evaluates an input against 2–10 ordered levels. Define the criteria for each level and arrange them from lowest to highest.

Package
Urgent request

Score an issue against severity levels
curl https://api.openai.com/v1/decisions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-6-luna",
    "input": "Export fails in Safari but works in Chrome.",
    "questions": [{
      "type": "score",
      "name": "severity",
      "instructions": "How severe is this issue?",
      "levels": [
        {"label": "Cosmetic", "description": "Appearance only; no lost functionality."},
        {"label": "Workaround available", "description": "A task fails, but another way works."},
        {"label": "Fully blocked", "description": "A task fails with no workaround."}
      ]
    }]
  }'
An illustrative response excerpt:

{
  "answers": [
    {
      "type": "score",
      "name": "severity",
      "score": 1.1,
      "probabilities": [
        { "value": 0, "label": "Cosmetic", "probability": 0.1 },
        { "value": 1, "label": "Workaround available", "probability": 0.7 },
        { "value": 2, "label": "Fully blocked", "probability": 0.2 }
      ],
      "confidence": 0.55
    }
  ]
}

Level indices start at 0. Here, 0 means cosmetic, 1 means a workaround is available, and 2 means fully blocked. The returned score is a probability-weighted average, so it can fall between levels. In this example, probabilities of 0.1, 0.7, and 0.2 produce a score of 1.1.

The answer also includes confidence and the per-level probabilities. The score summarizes the distribution across levels. Use choice to select a single category.

Ask multiple questions

Include between 1 and 400 questions in a request. Put independent questions in the same questions array to evaluate shared input. For a product photo, one request can check for damage and classify the product category. Each question can use a different type.

For decisions that depend on an earlier answer, send separate requests. For example, check for damage first, then use the result to decide whether to request a repair category.

Write questions around observable criteria. Separate different concerns into different questions, give choices distinct meanings, and define score levels so that adjacent levels have distinct criteria.

Interpret the answers

Predicates return the estimated probability that a condition is true. Choice and score answers return a probability distribution and a separate confidence field.

Use labeled examples from your application to set thresholds for routing, filtering, or review. Choose thresholds based on the cost of false positives and false negatives.

Reuse shared input with prompt caching

Prompt caching lets repeated requests reuse a matching prefix of shared input and receive discounted cache-read pricing. For example, keep a reference document or image in input and change the questions for each request. Content in questions, including question-specific images, is outside the reusable prefix.

By default, Decisions places an implicit cache breakpoint at the end of shared input. Existing requests can benefit without changing their request body. The reusable prefix must contain at least 1,024 tokens; question content doesn’t count toward this threshold. Keep the prefix identical across requests to allow reuse.

Use prompt_cache_key to partition cache reuse by a caller-provided key. For control over the boundary, add prompt_cache_breakpoint: {"mode": "explicit"} to text or image content parts in shared input. Set prompt_cache_options.mode to "explicit" to use only marked boundaries. In explicit mode, a request with no marked boundaries doesn’t use prompt caching. Breakpoints aren’t supported in question instructions.

Check usage.input_tokens_details.cached_tokens for cache reads and usage.input_tokens_details.cache_write_tokens for cache writes. Both counts are included in usage.input_tokens; don’t add them to that total. See the prompt caching guide for caching concepts and the Decisions reference for supported request controls.

Monitor usage

Use GET /v1/organization/usage/decisions to retrieve your organization’s Decisions token usage and request counts. Authenticate with an admin API key and the api.usage.read permission.

Choose a time range and bucket width, then filter or group the results by project, API key, or model. The num_model_requests field counts requests, not individual questions: a request with several questions counts once. See the Decisions usage reference for filters and pagination.

Pricing and availability

With gpt-6-luna, uncached input costs $0.10 per 1M tokens. Prompt cache hits receive discounted input pricing; cache writes are charged. Cache-read and cache-write rates match the standard gpt-6-luna prompt caching rates. Output tokens are not charged.

Regional processing premiums and long-context input pricing multipliers apply. These rates apply to /v1/decisions; other requests using gpt-6-luna follow the applicable model and processing-tier pricing.

The Decisions API supports Zero Data Retention (ZDR) and HIPAA use for eligible customers. Data residency is available in all supported API regions. Regional processing is supported in the United States and Europe (EEA + Switzerland). See data controls for eligibility requirements, required agreements, and limitations.

Add voice control

Connect voice to Decisions to choose an action from a spoken request or react as your user or GPT-Live speaks.