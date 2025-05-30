import requests
import json
import time
from typing import List, Dict, Any

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    def generate(self, model: str, prompt: str, stream: bool = False) -> str:
        url = f"{self.base_url}/api/generate"
        data = {
            "model": model,
            "prompt": prompt,
            "stream": stream
        }
        
        if stream:
            response = requests.post(url, json=data, stream=True)
            full_response = ""
            for line in response.iter_lines():
                if line:
                    json_response = json.loads(line)
                    if 'response' in json_response:
                        chunk = json_response['response']
                        print(chunk, end='', flush=True)
                        full_response += chunk
            print("\n")
            return full_response
        else:
            response = requests.post(url, json=data)
            return response.json()['response']

def test_individual_models():
    """Test each model individually with a simple prompt"""
    client = OllamaClient()
    models = ['supervisor', 'aggressive-expert', 'measured-expert']
    prompt = "What's your approach to solving complex problems?"
    
    print("\n=== Testing Individual Models ===\n")
    for model in models:
        print(f"\n--- {model.upper()} ---")
        response = client.generate(model, prompt)
        print(f"Response: {response}\n")
        time.sleep(1)  # Small delay between requests

def run_panel_discussion(topic: str):
    """Run a panel discussion between all three experts"""
    client = OllamaClient()
    models = {
        'supervisor': 'supervisor',
        'aggressive': 'aggressive-expert',
        'measured': 'measured-expert'
    }
    
    # Initialize conversation history
    conversation_history = []
    
    # Initial prompt to start the discussion
    initial_prompt = f"""Let's discuss the following topic: {topic}

Please share your initial thoughts on this topic. Be concise and focus on your unique perspective."""

    print(f"\n=== Panel Discussion: {topic} ===\n")
    
    # Get initial responses
    responses = {}
    for role, model in models.items():
        print(f"\n--- {role.upper()} INITIAL THOUGHTS ---")
        response = client.generate(model, initial_prompt)
        responses[role] = response
        conversation_history.append({
            'role': role,
            'content': response
        })
        print(f"Response: {response}\n")
        time.sleep(1)

    # Continue discussion for multiple rounds
    max_rounds = 3
    for round_num in range(max_rounds):
        print(f"\n=== ROUND {round_num + 1} ===\n")
        
        # Format conversation history for context
        conversation_context = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}"
            for msg in conversation_history
        ])
        
        # Supervisor moderates the discussion
        moderation_prompt = f"""Based on the conversation so far:

{conversation_context}

As the supervisor, please:
1. Analyze the current state of the discussion
2. Identify specific areas that need deeper exploration
3. Choose ONE expert to respond first (either AGGRESSIVE or MEASURED)
4. Provide a specific question or challenge for that expert
5. Explain why you chose this expert and question

Format your response as:
ANALYSIS: [Your analysis of the discussion so far]
NEXT_EXPERT: [AGGRESSIVE or MEASURED]
QUESTION: [Your specific question or challenge]
RATIONALE: [Why you chose this expert and question]"""

        print("\n--- SUPERVISOR MODERATION ---")
        supervisor_response = client.generate(models['supervisor'], moderation_prompt)
        conversation_history.append({
            'role': 'supervisor',
            'content': supervisor_response
        })
        print(f"Response: {supervisor_response}\n")
        time.sleep(1)

        # Extract the chosen expert from supervisor's response
        chosen_expert = None
        if "NEXT_EXPERT: AGGRESSIVE" in supervisor_response:
            chosen_expert = 'aggressive'
        elif "NEXT_EXPERT: MEASURED" in supervisor_response:
            chosen_expert = 'measured'
        
        if chosen_expert:
            # Get response from chosen expert
            expert_prompt = f"""Here is the full conversation so far:

{conversation_context}

The supervisor has provided this guidance:

{supervisor_response}

Please respond to the supervisor's specific question or challenge while:
1. Maintaining your unique perspective and expertise
2. Building on or challenging previous points as relevant
3. Providing concrete examples or evidence to support your position
4. Keeping your response focused and concise"""

            print(f"\n--- {chosen_expert.upper()} RESPONSE ---")
            response = client.generate(models[chosen_expert], expert_prompt)
            conversation_history.append({
                'role': chosen_expert,
                'content': response
            })
            print(f"Response: {response}\n")
            time.sleep(1)

            # Get response from other expert
            other_expert = 'measured' if chosen_expert == 'aggressive' else 'aggressive'
            other_expert_prompt = f"""Here is the full conversation so far:

{conversation_context}

The supervisor has provided this guidance:

{supervisor_response}

{chosen_expert.upper()} has responded:

{response}

Please:
1. Respond to both the supervisor's guidance and {chosen_expert.upper()}'s points
2. Maintain your unique perspective and expertise
3. Build on or challenge previous points as relevant
4. Provide concrete examples or evidence to support your position
5. Keep your response focused and concise"""

            print(f"\n--- {other_expert.upper()} RESPONSE ---")
            other_response = client.generate(models[other_expert], other_expert_prompt)
            conversation_history.append({
                'role': other_expert,
                'content': other_response
            })
            print(f"Response: {other_response}\n")
            time.sleep(1)

    # Final summary from supervisor
    final_prompt = f"""Based on the complete discussion:

{conversation_context}

Please provide a final summary that:
1. Synthesizes the key points of agreement and disagreement
2. Highlights the most valuable insights from each expert
3. Identifies concrete next steps or recommendations
4. Acknowledges any remaining open questions or challenges

Format your response as:
KEY_AGREEMENTS: [List key points of agreement]
KEY_DISAGREEMENTS: [List key points of disagreement]
VALUABLE_INSIGHTS: [List key insights from each expert]
NEXT_STEPS: [List concrete next steps or recommendations]
OPEN_QUESTIONS: [List remaining questions or challenges]"""

    print("\n--- FINAL SUPERVISOR SUMMARY ---")
    final_summary = client.generate(models['supervisor'], final_prompt)
    print(f"Response: {final_summary}\n")

def main():
    # Test individual models
    test_individual_models()
    
    # Run a panel discussion
    topic = "The impact of artificial intelligence on software development"
    run_panel_discussion(topic)

if __name__ == "__main__":
    main() 