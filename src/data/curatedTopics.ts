import { ExplanationSection, QCMQuestion } from '../types/harness';

export interface CuratedTopic {
  slug: string;
  title: string;
  keywords: string[];
  explanation: ExplanationSection;
  questions: QCMQuestion[];
  relatedTopics: string[];
}

export const CURATED_TOPICS: CuratedTopic[] = [
  {
    slug: 'transformer-attention',
    title: 'How Transformer Self-Attention Works',
    keywords: ['transformer', 'attention', 'self-attention', 'self attention', 'llm', 'query key value'],
    explanation: {
      bigPicture:
        'Before Transformers, models read text word-by-word like reading through a narrow keyhole, forgetting distant context. Self-attention lets every token look across the entire sequence at once and dynamically decide which other words matter most to its meaning right now.',
      mechanics: [
        'Each token is projected into three learned vectors: a Query (what I am looking for), a Key (what I advertise I contain), and a Value (the actual information I pass along).',
        'A token computes similarity scores by taking the dot product of its Query against every other token’s Key, scales by √d_k to keep gradients stable, and applies softmax so the weights sum to 1.',
        'Those attention weights multiply each token’s Value vector and sum them up, producing a context-aware representation (e.g., resolving whether "bank" means river or finance).',
        'Multi-head attention runs several of these projections in parallel so one head can track grammar, another coreference, and another long-range semantics.'
      ],
      pitfall:
        'Self-attention has no built-in sense of word order because it treats tokens as a set. Without positional encodings added to the inputs, "Dog bites man" and "Man bites dog" would produce identical attention outputs.',
      keyTerms: [
        { term: 'Query / Key / Value', definition: 'Three linear projections of each token used to match relevance (Q·K) and aggregate content (V).' },
        { term: '√d_k Scaling', definition: 'Dividing dot products by the square root of key dimension so softmax does not saturate into near-zero gradients.' },
        { term: 'Causal Mask', definition: 'Sets future token scores to -∞ before softmax during autoregressive generation so tokens cannot peek ahead.' }
      ]
    },
    questions: [
      {
        id: 'ta-1',
        tag: 'Core Concept',
        prompt: 'Why does a Transformer divide the Query–Key dot product by √d_k before applying softmax?',
        options: [
          'To normalize token embeddings to unit length in Euclidean space',
          'To prevent large dot products from pushing softmax into regions with tiny gradients',
          'To guarantee that attention weights are strictly sparse with exact zeros',
          'To reduce the quadratic memory complexity from O(n²) to O(n log n)'
        ],
        correctIndex: 1,
        rationale:
          'As the key dimension d_k grows, the variance of Q·K grows proportionally to d_k. Huge magnitudes push softmax into extreme tails where its gradient vanishes; scaling by √d_k keeps variance near 1.',
        deepNote:
          'Even with scaling, self-attention remains O(n²) in sequence length n because every token still attends to every other token.'
      },
      {
        id: 'ta-2',
        tag: 'Misconception',
        prompt: 'If you remove positional encodings from a standard Transformer encoder, what happens when you shuffle the input words?',
        options: [
          'The model throws a shape mismatch error during matrix multiplication',
          'Only the first token’s representation changes because attention flows left-to-right',
          'Every token receives the exact same contextual vector regardless of word order',
          'The attention matrix becomes the identity matrix'
        ],
        correctIndex: 2,
        rationale:
          'Self-attention is permutation-equivariant: without positional encodings, permuting the input tokens simply permutes the identical output vectors—it cannot distinguish "Alice helped Bob" from "Bob helped Alice".',
        deepNote:
          'Decoders with causal masking break full symmetry slightly via position in the triangular mask, yet positional information (like RoPE or sinusoidal encodings) is still essential to know relative distances.'
      },
      {
        id: 'ta-3',
        tag: 'Mechanism',
        prompt: 'In the attention formula softmax(QKᵀ / √d_k)V, what is the role of the Value (V) matrix?',
        options: [
          'It determines how strongly two tokens should attend to each other',
          'It stores the positional index of each token in the sequence',
          'It provides the content vectors that get blended according to the attention weights',
          'It masks out padding tokens so they do not affect loss calculation'
        ],
        correctIndex: 2,
        rationale:
          'Q and K only compute the normalized compatibility weights (how much to listen). V holds the actual representation payload that gets weighted and summed into the output.',
        deepNote:
          'Separating Key from Value lets a token advertise one feature for matching ("I am a verb") while passing a richer representation ("past tense action performed by X") when selected.'
      },
      {
        id: 'ta-4',
        tag: 'Application',
        prompt: 'During text generation in a GPT-style decoder, how is the model prevented from cheating by reading future tokens during training?',
        options: [
          'Future tokens are replaced with zero vectors in the Value matrix only',
          'Upper-triangular entries of QKᵀ are set to -∞ before the softmax step',
          'The decoder runs recurrently one token at a time during training',
          'Dropout randomly drops 100% of rightward attention weights'
        ],
        correctIndex: 1,
        rationale:
          'Setting future positions to -∞ before softmax makes exp(-∞) = 0, giving zero attention weight to future tokens while still allowing full parallel matrix computation across the sequence.',
        deepNote:
          'Masking after softmax would break the probability sum-to-1 property unless renormalized; masking before softmax is clean and mathematically exact.'
      },
      {
        id: 'ta-5',
        tag: 'Mechanism',
        prompt: 'What is the main advantage of Multi-Head Attention over a single giant attention head of the same total dimension?',
        options: [
          'It eliminates the need for residual connections and layer normalization',
          'It allows the model to jointly attend to different subspaces and relationships at once',
          'It cuts total parameter count in half compared to single-head attention',
          'It guarantees interpretable human-readable syntax trees'
        ],
        correctIndex: 1,
        rationale:
          'A single softmax distribution tends to average out or lock onto one dominant relation. Multiple heads let different subspaces simultaneously track syntax, pronoun resolution, and distant context.',
        deepNote:
          'With h heads of dimension d_model/h, total compute is roughly the same as one full-dimension head, yet expressiveness rises dramatically.'
      },
      {
        id: 'ta-6',
        tag: 'Core Concept',
        prompt: 'Why does standard self-attention become expensive for very long documents (e.g., 100k+ tokens)?',
        options: [
          'Time and memory for the attention matrix scale quadratically O(n²) with sequence length n',
          'The vocabulary size must double whenever the context window doubles',
          'Feed-forward layers require O(n³) tensor contractions across tokens',
          'Positional encodings overflow 32-bit floats beyond 4,096 tokens'
        ],
        correctIndex: 0,
        rationale:
          'Computing QKᵀ compares every token against every other token, forming an n × n attention matrix whose memory and FLOPs grow as O(n²).',
        deepNote:
          'Techniques like FlashAttention reduce memory I/O overhead without changing O(n²) FLOPs, while sparse or linear attention variants approximate the full matrix.'
      },
      {
        id: 'ta-7',
        tag: 'Application',
        prompt: 'In cross-attention inside an encoder–decoder model (like machine translation), where do Q, K, and V come from?',
        options: [
          'Q, K, and V all come from the encoder output',
          'Q comes from the decoder, while K and V come from the encoder output',
          'Q and K come from the decoder, while V comes from the encoder output',
          'K comes from the decoder, while Q and V come from the input embeddings'
        ],
        correctIndex: 1,
        rationale:
          'The decoder asks ("Queries") what source information it needs for the next target word, and matches against the encoded source sentence’s Keys and Values.',
        deepNote:
          'This bridges two different sequences (e.g., French target tokens querying English source tokens), even when they have completely different lengths.'
      }
    ],
    relatedTopics: ['Backpropagation & Gradient Descent', 'Positional Encodings & RoPE', 'Mixture of Experts']
  },
  {
    slug: 'quantum-entanglement',
    title: 'Quantum Entanglement',
    keywords: ['quantum entanglement', 'entanglement', 'bell state', 'epr', 'spooky action'],
    explanation: {
      bigPicture:
        'Quantum entanglement happens when two or more particles share a single unified quantum state rather than having separate, independent states. Measuring one particle immediately tells you the outcome of the other—no matter how far apart they are—even though neither particle had a definite value beforehand.',
      mechanics: [
        'In a classical pair of shoes placed in two boxes, each box already holds a left or right shoe before you open it. In an entangled Bell state, neither particle possesses a definite spin until measured.',
        'When Alice measures her particle along a chosen axis and gets "up", the shared wavefunction updates so Bob’s particle—if measured on the same axis—is guaranteed to show the correlated result ("down" for a singlet state).',
        'Bell’s Theorem and experiments prove these correlations are stronger than any local hidden-variable theory could produce: the particles were not secretly carrying pre-written instructions.',
        'Crucially, entanglement cannot transmit faster-than-light messages because Alice’s measurement outcome is completely random; Bob cannot tell whether Alice measured until they compare notes classically.'
      ],
      pitfall:
        'Entanglement does not let you send signals faster than light. If Alice tries to "force" her particle to spin up to signal a 1, quantum mechanics prevents her—she only observes a random 50/50 outcome, and Bob sees a random 50/50 stream until they communicate normally.',
      keyTerms: [
        { term: 'Bell State', definition: 'A maximally entangled two-qubit state where individual qubits are completely uncertain, yet jointly 100% correlated.' },
        { term: 'Local Hidden Variables', definition: 'The classical hypothesis that particles carry pre-determined values locally; ruled out by Bell test experiments.' },
        { term: 'No-Communication Theorem', definition: 'Mathematical proof that measuring one half of an entangled pair cannot alter the marginal probability distribution seen by the other observer.' }
      ]
    },
    questions: [
      {
        id: 'qe-1',
        tag: 'Misconception',
        prompt: 'Alice and Bob share an entangled pair of qubits light-years apart. Why can’t Alice use this to send an instant message to Bob?',
        options: [
          'Entanglement decays exponentially with distance in a vacuum',
          'Alice cannot choose her measurement outcome—both observers locally see random 50/50 results',
          'Bob’s qubit takes light-travel time to update its spin state',
          'Measuring Alice’s qubit always destroys Bob’s qubit before he can measure it'
        ],
        correctIndex: 1,
        rationale:
          'Because Alice’s measurement yields a fundamentally random outcome, she cannot encode a chosen bit into Bob’s local statistics. The correlation only becomes visible when they compare outcomes via a classical channel.',
        deepNote:
          'Mathematically, tracing out Alice’s qubit leaves Bob with the exact same maximally mixed density matrix regardless of what Alice does.'
      },
      {
        id: 'qe-2',
        tag: 'Core Concept',
        prompt: 'How does quantum entanglement differ from putting a left glove in one envelope and a right glove in another?',
        options: [
          'With gloves, the handedness is already fixed inside each envelope before opening; in entanglement, no definite local value exists prior to measurement',
          'With gloves, you cannot predict the other envelope after opening yours',
          'Entangled particles always give identical rather than opposite results',
          'Gloves violate conservation of angular momentum'
        ],
        correctIndex: 0,
        rationale:
          'The glove analogy represents local hidden variables (pre-existing properties). Bell tests measuring particles along angled axes reveal correlations impossible if values had been fixed beforehand.',
        deepNote:
          'Along a single axis, gloves and entanglement look identical; the quantum difference emerges when Alice and Bob measure along rotated angles (e.g., 22.5° and 45°).'
      },
      {
        id: 'qe-3',
        tag: 'Mechanism',
        prompt: 'What did Bell’s Theorem and subsequent Nobel-winning experiments establish?',
        options: [
          'Quantum mechanics is incomplete and particles carry hidden classical instructions',
          'No theory based on local hidden variables can reproduce all predictions of quantum mechanics',
          'Faster-than-light communication is possible using entangled photons',
          'Gravity is the mechanism that collapses entangled wavefunctions'
        ],
        correctIndex: 1,
        rationale:
          'John Bell derived an inequality that any local hidden-variable theory must obey. Experiments repeatedly violated Bell’s inequality in exact agreement with quantum mechanics.',
        deepNote:
          'Alain Aspect, John Clauser, and Anton Zeilinger won the 2022 Nobel Prize in Physics for closing loopholes in Bell tests.'
      },
      {
        id: 'qe-4',
        tag: 'Application',
        prompt: 'In quantum teleportation, an unknown quantum state is transferred from Alice to Bob using entanglement. What else is strictly required?',
        options: [
          'A physical quantum wire connecting Alice and Bob during the transfer',
          'Two classical bits sent from Alice to Bob at or below light speed',
          'Cloning Alice’s qubit first so a backup remains',
          'Cooling Bob’s qubit to exact absolute zero (0 K)'
        ],
        correctIndex: 1,
        rationale:
          'Alice performs a joint measurement on her qubit and the state to be teleported, then sends 2 classical bits telling Bob which correction gate (I, X, Z, or XZ) to apply.',
        deepNote:
          'This preserves both the No-Cloning Theorem (Alice’s original state is destroyed) and causality (limited by classical bit transmission).'
      },
      {
        id: 'qe-5',
        tag: 'Core Concept',
        prompt: 'Mathematically, what defines an entangled two-qubit state |ψ⟩?',
        options: [
          'It can be written as a product |ψ_A⟩ ⊗ |ψ_B⟩ of individual qubit states',
          'It cannot be factored into a tensor product of separate states for qubit A and qubit B',
          'Both qubits must have identical energy eigenvalues',
          'The amplitudes of all basis states must be real numbers'
        ],
        correctIndex: 1,
        rationale:
          'A state is entangled precisely when it is non-separable: there is no way to assign an independent pure state to A and B separately.',
        deepNote:
          'For example, (|00⟩ + |11⟩)/√2 cannot be written as (a|0⟩+b|1⟩)⊗(c|0⟩+d|1⟩) because ad and bc cannot both be zero while ac and bd are non-zero.'
      }
    ],
    relatedTopics: ['Quantum Computing Qubits', 'Double-Slit Experiment', 'Bell’s Inequality']
  },
  {
    slug: 'crispr-cas9',
    title: 'CRISPR-Cas9 Gene Editing',
    keywords: ['crispr', 'cas9', 'gene editing', 'dna editing', 'guide rna'],
    explanation: {
      bigPicture:
        'CRISPR-Cas9 is a repurposed bacterial immune system turned into programmable molecular scissors. Instead of engineering a custom protein for every DNA target, scientists give the Cas9 enzyme a short replaceable RNA "address label" that guides it straight to a matching sequence in the genome.',
      mechanics: [
        'A synthetic guide RNA (gRNA) combines a targeting sequence (~20 bases complementary to the desired DNA site) with a scaffold that binds the Cas9 protein.',
        'Cas9 patrols DNA looking first for a short 3-letter landing pad called a PAM (e.g., NGG for SpCas9), then checks if the adjacent DNA matches the guide RNA.',
        'When they match, Cas9 makes a double-strand break in the DNA. The cell’s own repair machinery rushes in to fix the break via one of two pathways.',
        'Non-Homologous End Joining (NHEJ) stitches ends rapidly but sloppily, often inserting/deleting bases to knock out a gene; Homology-Directed Repair (HDR) uses a provided DNA template to paste in a precise edit.'
      ],
      pitfall:
        'Cas9 does not "edit" or rewrite DNA by itself—it only cuts. The actual deletion or insertion is performed by the host cell’s natural DNA repair pathways after the cut.',
      keyTerms: [
        { term: 'Guide RNA (gRNA)', definition: 'Programmable ~20-nucleotide RNA sequence that directs Cas9 to a specific genomic address.' },
        { term: 'PAM Sequence', definition: 'Protospacer Adjacent Motif (e.g., 5′-NGG-3′) required right next to the target so Cas9 can bind and unwind DNA.' },
        { term: 'NHEJ vs. HDR', definition: 'Error-prone fast repair (great for gene knockouts) vs. template-guided precise repair (used for gene insertion).' }
      ]
    },
    questions: [
      {
        id: 'cr-1',
        tag: 'Misconception',
        prompt: 'In standard CRISPR-Cas9 gene editing, what actually introduces a new DNA sequence or knockout mutation at the target site?',
        options: [
          'The Cas9 enzyme synthesizes new DNA bases directly from RNA',
          'The cell’s own DNA repair machinery (NHEJ or HDR) responding to Cas9’s cut',
          'The PAM sequence detaches and inserts itself into the gene',
          'Reverse transcriptase inside the guide RNA rewrites the chromosome'
        ],
        correctIndex: 1,
        rationale:
          'Standard Cas9 is strictly an endonuclease—it makes a double-strand break. The cell’s repair pathways either make small indels (NHEJ) or copy a supplied template (HDR).',
        deepNote:
          'Newer variants like Base Editors and Prime Editors fuse disabled Cas9 ("nickase") to other enzymes to rewrite bases without making double-strand breaks.'
      },
      {
        id: 'cr-2',
        tag: 'Mechanism',
        prompt: 'Why is the PAM (Protospacer Adjacent Motif) sequence essential for Cas9 to cut DNA?',
        options: [
          'It acts as an initial recognition checkpoint before Cas9 unwinds DNA to check the guide RNA',
          'It supplies the ATP energy required to break phosphodiester bonds',
          'It prevents the guide RNA from folding onto itself inside the nucleus',
          'It signals the cell to choose HDR over NHEJ'
        ],
        correctIndex: 0,
        rationale:
          'Without checking for a PAM first, Cas9 would waste vast time unzipping every DNA base pair in the genome. The PAM lets Cas9 quickly scan DNA and also stops bacteria from cutting their own CRISPR locus (which lacks PAMs).',
        deepNote:
          'For common Streptococcus pyogenes Cas9, the PAM is 5′-NGG-3′; engineered Cas variants relax this constraint to target nearly any site.'
      },
      {
        id: 'cr-3',
        tag: 'Application',
        prompt: 'A researcher wants to disable ("knock out") a faulty disease gene quickly without supplying a repair template. Which pathway are they relying on?',
        options: [
          'Homology-Directed Repair (HDR)',
          'Non-Homologous End Joining (NHEJ)',
          'Base Excision Repair (BER)',
          'RNA Interference (RNAi)'
        ],
        correctIndex: 1,
        rationale:
          'NHEJ rapidly glues broken DNA ends back together but frequently adds or deletes a few bases (indels), causing a frameshift mutation that disables the gene.',
        deepNote:
          'NHEJ is active throughout the cell cycle, whereas HDR is mostly restricted to dividing cells (S/G2 phases), making precise knock-ins harder in non-dividing neurons.'
      },
      {
        id: 'cr-4',
        tag: 'Core Concept',
        prompt: 'Why did CRISPR-Cas9 revolutionize biotechnology compared to earlier tools like ZFNs and TALENs?',
        options: [
          'It is the only tool capable of cutting double-stranded DNA',
          'Retargeting requires changing only a short RNA guide instead of re-engineering a whole protein',
          'It never causes off-target cuts anywhere in the genome',
          'It works without entering the cell nucleus'
        ],
        correctIndex: 1,
        rationale:
          'ZFNs and TALENs required designing and cloning a brand-new DNA-binding protein for every target site. With CRISPR, the Cas9 protein stays constant and you simply swap a cheap 20-nt guide RNA.',
        deepNote:
          'This modularity also enables genome-wide CRISPR screens where thousands of guide RNAs are tested in parallel.'
      },
      {
        id: 'cr-5',
        tag: 'Core Concept',
        prompt: 'What is the original biological purpose of CRISPR in bacteria and archaea?',
        options: [
          'An adaptive immune memory system that recognizes and destroys invading viral DNA',
          'A metabolic pathway for digesting complex sugars',
          'A mechanism to speed up binary fission under heat stress',
          'A method for exchanging antibiotic resistance plasmids'
        ],
        correctIndex: 0,
        rationale:
          'Bacteria store snippets of past bacteriophage DNA in their CRISPR arrays, transcribe them into guide RNAs, and use Cas proteins to slice matching viral genomes if the virus returns.',
        deepNote:
          'This explains why bacteria keep a memory of past infections—making CRISPR a rare example of Lamarckian-like heritable adaptation in microbes.'
      }
    ],
    relatedTopics: ['mRNA Vaccines', 'Epigenetics', 'Prime Editing']
  },
  {
    slug: 'http3-quic',
    title: 'HTTP/3 & the QUIC Protocol',
    keywords: ['http/3', 'http3', 'quic', 'tcp head of line', 'transport protocol'],
    explanation: {
      bigPicture:
        'For decades, web traffic ran over TCP, which treats every connection as a single strict conveyor belt of bytes—if one packet drops, everything behind it freezes. HTTP/3 replaces TCP with QUIC (built atop UDP), giving each stream its own independent lane and baking TLS encryption straight into the handshake.',
      mechanics: [
        'In HTTP/2 over TCP, multiple streams share one TCP connection. If a single TCP packet is lost, the OS kernel stalls all streams waiting for retransmission (TCP head-of-line blocking).',
        'QUIC implements reliable delivery in user space over UDP, multiplexing independent streams so packet loss in one image or API call does not stall CSS or other streams.',
        'QUIC merges transport setup and TLS 1.3 encryption into a single 1-RTT handshake (or 0-RTT for repeat visits), cutting connection latency noticeably on mobile networks.',
        'Instead of tying connections to an IP address + port tuple, QUIC uses a Connection ID—so walking from Wi-Fi to 5G keeps your download alive without dropping.'
      ],
      pitfall:
        'People often assume QUIC is "unreliable" because it runs over UDP. In reality, QUIC implements its own reliability, congestion control, and ordered delivery per stream—it simply uses UDP as a minimal packet carrier to bypass ossified TCP middleboxes.',
      keyTerms: [
        { term: 'Head-of-Line (HoL) Blocking', definition: 'When one lost packet stalls unrelated data behind it; solved across streams by QUIC.' },
        { term: 'Connection ID', definition: 'Identifier allowing QUIC sessions to survive IP changes when switching between Wi-Fi and cellular.' },
        { term: '0-RTT / 1-RTT Handshake', definition: 'Combined transport + TLS 1.3 negotiation saving round trips compared to TCP + TLS.' }
      ]
    },
    questions: [
      {
        id: 'hq-1',
        tag: 'Misconception',
        prompt: 'HTTP/3 runs over UDP via QUIC. Does this mean HTTP/3 drops packets without retransmitting them?',
        options: [
          'Yes, web browsers rely on application code to manually retry lost images',
          'No—QUIC builds per-stream reliability, congestion control, and loss recovery on top of UDP',
          'Yes, except for HTML documents which fall back to TCP',
          'No—UDP itself was upgraded in Linux 6 to guarantee packet delivery'
        ],
        correctIndex: 1,
        rationale:
          'UDP provides only a thin datagram wrapper so firewalls and routers let packets pass. QUIC itself implements acknowledgments, retransmission, and congestion control per independent stream.',
        deepNote:
          'Running in user space over UDP also lets browsers and servers deploy transport improvements rapidly without waiting years for OS kernel updates.'
      },
      {
        id: 'hq-2',
        tag: 'Core Concept',
        prompt: 'What specific problem in HTTP/2 over TCP motivated moving to QUIC?',
        options: [
          'HTTP/2 lacked header compression',
          'TCP head-of-line blocking: losing one packet stalls every multiplexed HTTP/2 stream on that connection',
          'TCP cannot carry TLS 1.3 encrypted payloads',
          'HTTP/2 only supported one request at a time per domain'
        ],
        correctIndex: 1,
        rationale:
          'HTTP/2 solved HTTP-level HoL blocking via multiplexing, only to hit transport-level HoL blocking inside TCP whenever a single packet dropped on lossy wireless networks.',
        deepNote:
          'Note that within a single QUIC stream, bytes are still delivered in order—what QUIC eliminates is cross-stream blocking.'
      },
      {
        id: 'hq-3',
        tag: 'Mechanism',
        prompt: 'Why does a QUIC connection survive seamlessly when your phone switches from home Wi-Fi to 5G?',
        options: [
          'QUIC broadcasts packets to both Wi-Fi and 5G towers simultaneously',
          'QUIC identifies connections via a Connection ID rather than the source IP and port pair',
          'Your mobile carrier preserves your home Wi-Fi IP address',
          'DNS automatically re-resolves mid-packet without closing sockets'
        ],
        correctIndex: 1,
        rationale:
          'TCP connections are bound to the 4-tuple (src IP, src port, dst IP, dst port), so an IP change breaks the socket. QUIC’s Connection ID lets the server recognize the migrated session.',
        deepNote:
          'Connection migration also includes path validation challenges to prevent IP spoofing attacks.'
      },
      {
        id: 'hq-4',
        tag: 'Mechanism',
        prompt: 'How does QUIC achieve faster initial connection setup than traditional TCP + TLS 1.3?',
        options: [
          'It skips cryptographic certificate verification on mobile devices',
          'It combines transport negotiation and TLS 1.3 key exchange into a single 1-RTT handshake',
          'It pre-connects to every website listed in the browser bookmarks',
          'It compresses the TCP three-way handshake into ICMP pings'
        ],
        correctIndex: 1,
        rationale:
          'TCP + TLS 1.3 requires TCP’s handshake first (1 RTT) followed by TLS’s handshake (1 RTT). QUIC fuses them so encrypted application data flows after just 1 RTT (or 0-RTT when resuming).',
        deepNote:
          'Encrypted transport headers in QUIC also stop intermediate middleboxes from tampering with protocol extensions.'
      },
      {
        id: 'hq-5',
        tag: 'Application',
        prompt: 'Why was QUIC built over UDP instead of creating a brand-new IP protocol number alongside TCP and UDP?',
        options: [
          'IPv4 headers have no field for protocol numbers',
          'Millions of legacy NATs, firewalls, and routers drop unknown IP protocols but pass UDP port 443',
          'UDP has a larger maximum packet size than IP',
          'Browsers do not have permission to send raw TCP packets'
        ],
        correctIndex: 1,
        rationale:
          'Protocol ossification means middleboxes on the internet discard unfamiliar IP protocols. Encapsulating QUIC inside UDP lets it traverse existing internet infrastructure immediately.',
        deepNote:
          'Clients still keep HTTP/2 over TCP as a fallback in case strict corporate firewalls block UDP port 443.'
      }
    ],
    relatedTopics: ['DNS & Domain Resolution', 'TLS 1.3 Handshake', 'TCP Congestion Control']
  },
  {
    slug: 'backpropagation',
    title: 'Backpropagation & Gradient Descent',
    keywords: ['backpropagation', 'gradient descent', 'neural network training', 'chain rule'],
    explanation: {
      bigPicture:
        'Training a neural network is a giant game of "who is to blame for the error?" Backpropagation uses the calculus chain rule backward from the final loss to tell every single weight—millions or billions of them—whether nudging it up or down will reduce mistakes.',
      mechanics: [
        'In the forward pass, inputs flow layer by layer through weights and nonlinear activation functions until the network outputs a prediction and computes a scalar Loss.',
        'In the backward pass, backpropagation computes ∂Loss/∂weight for every parameter by multiplying local derivatives backward from the output layer toward the input.',
        'Gradient descent (or optimizers like Adam) then steps each weight slightly in the opposite direction of its gradient: w_new = w_old - η · gradient.',
        'Crucially, intermediate activations from the forward pass must be stored in memory so the backward pass can evaluate local derivatives efficiently.'
      ],
      pitfall:
        'Backpropagation is NOT the optimization algorithm itself—it is only the efficient method for computing gradients. Gradient Descent (or AdamW) is the optimizer that actually uses those gradients to update weights.',
      keyTerms: [
        { term: 'Chain Rule', definition: 'Calculus identity allowing error signals to multiply backward through composed layers.' },
        { term: 'Learning Rate (η)', definition: 'Step size hyperparameter controlling how aggressively weights move opposite the gradient.' },
        { term: 'Vanishing Gradient', definition: 'When repeated multiplication of small derivatives (<1) shrinks early-layer gradients near zero.' }
      ]
    },
    questions: [
      {
        id: 'bp-1',
        tag: 'Misconception',
        prompt: 'Which statement accurately distinguishes backpropagation from gradient descent?',
        options: [
          'Backpropagation updates the weights; gradient descent computes the loss',
          'Backpropagation computes the gradients via the chain rule; gradient descent uses them to update weights',
          'Gradient descent is only for linear regression, while backpropagation replaces it in deep networks',
          'They are two names for the exact same step'
        ],
        correctIndex: 1,
        rationale:
          'Backpropagation is reverse-mode automatic differentiation: it calculates ∂L/∂w efficiently. Optimizers like SGD or Adam then use those gradients to change weights.',
        deepNote:
          'You could swap SGD for Adam or Lion without changing how backpropagation computes gradients.'
      },
      {
        id: 'bp-2',
        tag: 'Mechanism',
        prompt: 'Why does training a neural network consume much more GPU memory than running inference with the same model?',
        options: [
          'Weights must be duplicated three times per layer during training',
          'Forward-pass intermediate activations must be cached in memory to compute gradients during backprop',
          'Inference skips matrix multiplications and only uses biases',
          'Loss functions require storing the entire training dataset on GPU at once'
        ],
        correctIndex: 1,
        rationale:
          'To evaluate ∂L/∂w in the backward pass, each layer needs the input activations it saw during the forward pass (plus optimizer states like momentum and variance in Adam).',
        deepNote:
          'Activation checkpointing trades extra compute for lower memory by discarding activations and recomputing them on the fly during backprop.'
      },
      {
        id: 'bp-3',
        tag: 'Core Concept',
        prompt: 'Why did deep networks historically struggle with sigmoid activations before ReLU and residual connections?',
        options: [
          'Sigmoid outputs are non-differentiable at zero',
          'Sigmoid’s derivative peaks at 0.25, so multiplying many layers shrinks early-layer gradients toward zero',
          'Sigmoid cannot output probabilities between 0 and 1',
          'Sigmoid causes infinite memory allocation'
        ],
        correctIndex: 1,
        rationale:
          'Multiplying numbers ≤ 0.25 across 20 layers yields (0.25)^20 ≈ 10^-12—vanishing gradients starve early layers of learning signal.',
        deepNote:
          'ReLU has derivative 1 for positive inputs, and residual skip connections (x + F(x)) create an unimpeded gradient highway.'
      },
      {
        id: 'bp-4',
        tag: 'Application',
        prompt: 'If your training loss suddenly shoots up to NaN (Not a Number) after a few steps, what is the most common cause and immediate fix?',
        options: [
          'The learning rate is too high or gradients exploded—lower the learning rate and add gradient clipping',
          'The dataset is too large—delete half the training examples',
          'The model needs zero initialization for all weights',
          'Batch size should be set to 1'
        ],
        correctIndex: 0,
        rationale:
          'Excessive step sizes or exploding gradients overshoot minima into floating-point overflow (Inf/NaN). Lowering learning rate and clipping gradient norms stabilizes updates.',
        deepNote:
          'Initializing all weights to zero causes symmetry: every neuron in a layer computes the exact same gradient and never differentiates.'
      },
      {
        id: 'bp-5',
        tag: 'Core Concept',
        prompt: 'Why does reverse-mode autodiff (backprop) beat forward-mode autodiff for neural networks?',
        options: [
          'Neural networks have millions of parameters (inputs to loss) and a single scalar loss (1 output)',
          'Forward-mode cannot differentiate ReLU or softmax',
          'Reverse-mode gives exact answers while forward-mode only approximates',
          'Reverse-mode eliminates the need for a forward pass'
        ],
        correctIndex: 0,
        rationale:
          'Reverse-mode computes derivatives of one scalar output with respect to millions of parameters in a single backward sweep, whereas forward-mode would need one pass per parameter.',
        deepNote:
          'Conversely, if you had 3 inputs and 1 million outputs, forward-mode would be faster.'
      }
    ],
    relatedTopics: ['How Transformer Self-Attention Works', 'AdamW Optimizer', 'Loss Landscapes']
  },
  {
    slug: 'byzantine-fault-tolerance',
    title: 'Byzantine Fault Tolerance (BFT)',
    keywords: ['byzantine fault tolerance', 'bft', 'consensus', 'pbft', 'byzantine generals'],
    explanation: {
      bigPicture:
        'In distributed systems, some computers simply crash and go silent. In harder environments—like blockchains or aerospace flight computers—nodes can actively lie, send conflicting messages to different peers, or behave maliciously. Byzantine Fault Tolerance guarantees honest nodes still reach agreement anyway.',
      mechanics: [
        'Named after the Byzantine Generals Problem: generals surrounding a city must agree to attack or retreat via messengers, knowing some generals may be traitors sending "attack" to one ally and "retreat" to another.',
        'Classic crash-tolerant consensus (like Raft or Paxos) only needs 2f + 1 nodes to survive f crashed nodes, because silent nodes never lie.',
        'BFT consensus requires at least 3f + 1 total nodes to tolerate f arbitrary/malicious (Byzantine) faults.',
        'Why 3f + 1? Because you must hear from a quorum of at least 2f + 1 nodes (so you don’t stall if f crash), and among those 2f + 1 replies, f could be liars—leaving f + 1 honest votes to outnumber the f liars.'
      ],
      pitfall:
        'A common mistake is thinking 2f + 1 nodes is enough for BFT. If you have 3 nodes and 1 is a traitor (f=1), two honest generals receiving conflicting orders cannot tell whether the other honest node or the third node is the traitor.',
      keyTerms: [
        { term: '3f + 1 Bound', definition: 'Minimum total nodes needed to tolerate f Byzantine (lying/arbitrary) nodes under partial synchrony.' },
        { term: 'Equivocation', definition: 'When a malicious node signs and sends two contradictory messages to different peers.' },
        { term: 'Safety vs. Liveness', definition: 'Safety: honest nodes never decide conflicting values. Liveness: honest nodes eventually decide.' }
      ]
    },
    questions: [
      {
        id: 'bft-1',
        tag: 'Core Concept',
        prompt: 'What is the minimum number of nodes required in a classic asynchronous/partially synchronous BFT system to tolerate f = 2 malicious nodes?',
        options: ['4 nodes', '5 nodes', '7 nodes', '9 nodes'],
        correctIndex: 2,
        rationale:
          'BFT requires n ≥ 3f + 1. For f = 2, 3(2) + 1 = 7 nodes. (Crash-fault protocols like Raft would only need 2(2) + 1 = 5 nodes.)',
        deepNote:
          'With 7 nodes, a quorum size of 5 (n - f) guarantees liveness even if 2 nodes go offline, and guarantees any two quorums intersect in at least 3 nodes—containing at least 1 honest node.'
      },
      {
        id: 'bft-2',
        tag: 'Misconception',
        prompt: 'Why can’t a 3-node BFT cluster (n = 3) tolerate even 1 Byzantine traitor (f = 1)?',
        options: [
          'Because 3 is an odd number and TCP requires even quorums',
          'An honest node cannot distinguish whether a silent/conflicting message came from the traitor or an honest peer',
          'Three nodes cannot exchange cryptographic signatures',
          'Because f = 1 requires waiting forever for 4 responses'
        ],
        correctIndex: 1,
        rationale:
          'In the classic 3-general scenario, if the commander tells General A "Attack" and General B "Retreat" (or General B lies about what the commander said), A sees two conflicting stories with no tie-breaker.',
        deepNote:
          'If nodes share unforgeable cryptographic signatures AND synchronous network timing bounds, some variants improve—but without synchrony assumptions, 3f + 1 is mathematically tight.'
      },
      {
        id: 'bft-3',
        tag: 'Core Concept',
        prompt: 'How does a "Byzantine fault" differ from a "crash fault" (like in Raft or Paxos)?',
        options: [
          'Crash faults happen only due to hardware failure; Byzantine faults mean power outages',
          'Crash-faulty nodes only stop responding; Byzantine nodes can behave arbitrarily, including lying and equivocating',
          'Byzantine faults occur only in wireless networks',
          'Crash faults violate safety while Byzantine faults only hurt latency'
        ],
        correctIndex: 1,
        rationale:
          'A crashed server might slow down or drop packets, but it never fabricates valid-looking conflicting votes. Byzantine nodes encompass bugs, cosmic-ray bit flips, and adversarial attackers.',
        deepNote:
          'That is why internal cloud clusters use Raft/Paxos (cheaper, 2f+1), while open multi-party networks use BFT (3f+1).'
      },
      {
        id: 'bft-4',
        tag: 'Mechanism',
        prompt: 'In BFT consensus, what do the guarantees "Safety" and "Liveness" mean?',
        options: [
          'Safety means TLS encryption is enabled; Liveness means CPU usage stays below 80%',
          'Safety means honest nodes never commit conflicting values; Liveness means valid requests eventually commit',
          'Safety means zero latency; Liveness means nodes never reboot',
          'Safety applies to reads; Liveness applies only to writes'
        ],
        correctIndex: 1,
        rationale:
          'Safety ("nothing bad happens") forbids forks/double-commits; Liveness ("something good eventually happens") ensures the system makes progress rather than halting forever.',
        deepNote:
          'By the FLP impossibility theorem, no deterministic protocol can guarantee both safety and liveness in a purely asynchronous network with even one crash.'
      }
    ],
    relatedTopics: ['Raft Consensus', 'CAP Theorem', 'Zero-Knowledge Proofs']
  },
  {
    slug: 'compound-interest-inflation',
    title: 'Compound Interest & Real Yield',
    keywords: ['compound interest', 'inflation', 'real yield', 'nominal return', 'purchasing power'],
    explanation: {
      bigPicture:
        'Compound interest is growth feeding on past growth—snowballing over time—while inflation silently erodes what each dollar can buy. Real yield is the difference that actually matters: how much more real stuff your money can purchase next year compared to today.',
      mechanics: [
        'With simple interest, you earn returns only on your original principal. With compound interest, each period’s interest joins the principal, making growth exponential: A = P(1 + r)ᵗ.',
        'The Rule of 72 gives a fast mental estimate of doubling time: divide 72 by the annual percentage rate (e.g., 8% doubles in ~9 years).',
        'Nominal return is the headline percentage on your bank or brokerage statement. Real return adjusts for inflation via the Fisher equation: (1 + r_real) = (1 + r_nominal) / (1 + inflation).',
        'If your savings account pays 3% nominal interest while inflation runs at 4%, your account balance rises—yet your real purchasing power shrinks by roughly 1% per year.'
      ],
      pitfall:
        'Confusing nominal wealth with real purchasing power—and forgetting that taxes are levied on nominal gains, not real gains. Even matching inflation before tax leaves you poorer after taxes.',
      keyTerms: [
        { term: 'Rule of 72', definition: 'Quick heuristic: 72 ÷ annual rate ≈ years required for an investment to double.' },
        { term: 'Nominal vs. Real Yield', definition: 'Headline dollar return vs. inflation-adjusted purchasing power return.' },
        { term: 'Compounding Frequency', definition: 'How often interest joins principal (annual, monthly, daily); more frequent compounding yields slightly higher effective APY.' }
      ]
    },
    questions: [
      {
        id: 'ci-1',
        tag: 'Application',
        prompt: 'You invest $10,000 in a bond paying 5% nominal interest for one year while inflation is 6%. What happened to your purchasing power?',
        options: [
          'It grew by 5% because you now have $10,500',
          'It fell by roughly 1% because prices rose faster than your balance',
          'It stayed exactly flat',
          'It grew by 11% combined'
        ],
        correctIndex: 1,
        rationale:
          'Exact real return = (1.05 / 1.06) - 1 ≈ -0.94%. You have more dollars ($10,500), but goods that cost $10,000 now cost $10,600.',
        deepNote:
          'And if you pay 20% tax on the $500 nominal interest, your after-tax real return drops even further to around -1.9%.'
      },
      {
        id: 'ci-2',
        tag: 'Application',
        prompt: 'Using the Rule of 72, roughly how long does it take money compounding at 6% per year to double?',
        options: ['6 years', '9 years', '12 years', '18 years'],
        correctIndex: 2,
        rationale:
          '72 ÷ 6 = 12 years. (Exact math: ln(2) / ln(1.06) = 11.9 years—remarkably close!)',
        deepNote:
          'The Rule of 72 works in reverse for inflation too: at 6% inflation, your cash loses half its purchasing power in ~12 years.'
      },
      {
        id: 'ci-3',
        tag: 'Core Concept',
        prompt: 'Why does starting to invest at age 25 vs. age 35 make such a dramatic difference by age 65, even with the same monthly contribution?',
        options: [
          'Stock fees are lower for younger investors',
          'Compound growth is exponential, so the final 10 years generate far more absolute dollars than the first 10 years',
          'Inflation only affects accounts opened after age 30',
          'Simple interest converts to compound interest after 20 years'
        ],
        correctIndex: 1,
        rationale:
          'Because exponent t sits in (1 + r)ᵗ, cutting 10 years off the timeline doesn’t trim the beginning—it chops off the huge final doubling period at the end.',
        deepNote:
          'At 7% real return, an extra 10 years roughly doubles the final portfolio size without adding a cent more per month.'
      },
      {
        id: 'ci-4',
        tag: 'Misconception',
        prompt: 'An investment falls 50% in Year 1 and gains 50% in Year 2. Where do you stand?',
        options: [
          'Back at break-even (0% net change)',
          'Up 12.5%',
          'Down 25% from your starting balance',
          'Down 5% from your starting balance'
        ],
        correctIndex: 2,
        rationale:
          '$100 → -50% → $50 → +50% → $75. Because gains compound on a smaller base, a 50% loss requires a 100% gain just to get back to even.',
        deepNote:
          'This asymmetry (volatility drag) is why minimizing catastrophic drawdowns matters so much in compounding.'
      }
    ],
    relatedTopics: ['Black-Scholes Option Pricing', 'Time Value of Money', 'Bond Duration']
  },
  {
    slug: 'mrna-vaccines',
    title: 'How mRNA Vaccines Train Immunity',
    keywords: ['mrna vaccine', 'mrna', 'vaccine', 'immune memory', 'spike protein'],
    explanation: {
      bigPicture:
        'Traditional vaccines deliver weakened germs or pre-made viral pieces so your immune system can practice fighting them. mRNA vaccines instead deliver a temporary digital recipe—a strip of messenger RNA—letting your own cells briefly print one harmless viral protein (like the spike) so your immune system learns to recognize it without ever meeting the real virus.',
      mechanics: [
        'Fragile mRNA molecules are wrapped in microscopic fat bubbles called lipid nanoparticles (LNPs) that protect them in the bloodstream and help them slip into muscle and immune cells.',
        'Once inside the cell’s cytoplasm (outside the nucleus), your ribosomes read the mRNA recipe and assemble copies of the harmless target antigen protein.',
        'Your cell displays these proteins on its surface, triggering B cells (which learn to make neutralizing antibodies) and T cells (which learn to clear infected cells).',
        'Within days, natural cellular enzymes break down both the mRNA instructions and the printed proteins—leaving behind long-lived memory B and T cells ready for a real infection.'
      ],
      pitfall:
        'mRNA never enters the cell nucleus where your DNA lives, and human cells lack the machinery needed to copy mRNA back into DNA. It is a short-lived recipe that dissolves after use.',
      keyTerms: [
        { term: 'Lipid Nanoparticle (LNP)', definition: 'Protective fatty shell that shields mRNA from degradation and ferries it across cell membranes.' },
        { term: 'Ribosome', definition: 'Cellular protein-making machine in the cytoplasm that translates mRNA into protein.' },
        { term: 'Antigen', definition: 'A harmless viral fragment (e.g., spike protein) that trains the immune system without causing disease.' }
      ]
    },
    questions: [
      {
        id: 'mv-1',
        tag: 'Misconception',
        prompt: 'Why cannot an mRNA vaccine alter your permanent DNA genome?',
        options: [
          'mRNA is made of proteins that dissolve before touching cells',
          'Translation happens in the cytoplasm without entering the nucleus, and human cells lack reverse transcriptase to turn mRNA into DNA',
          'The lipid nanoparticle permanently seals the nucleus shut',
          'mRNA only enters red blood cells, which have no DNA'
        ],
        correctIndex: 1,
        rationale:
          'mRNA stays in the cytoplasm where ribosomes translate it, never crossing into the nucleus, and is rapidly degraded by RNase enzymes within days.',
        deepNote:
          'Additionally, vaccine mRNA uses modified nucleosides (like N1-methylpseudouridine) to keep innate inflammation mild while boosting protein translation.'
      },
      {
        id: 'mv-2',
        tag: 'Mechanism',
        prompt: 'What is the essential job of the lipid nanoparticle (LNP) in an mRNA vaccine?',
        options: [
          'It directly destroys circulating viruses in the bloodstream',
          'It protects fragile mRNA from rapid enzyme breakdown and helps it enter cells',
          'It acts as the viral spike protein itself',
          'It permanently stores the vaccine inside bone marrow'
        ],
        correctIndex: 1,
        rationale:
          'Naked mRNA injected into tissue is chewed up by RNase enzymes in minutes and cannot easily cross negatively charged cell membranes. LNPs solve both problems.',
        deepNote:
          'Decades of lipid chemistry research (especially ionizable lipids) made mRNA delivery viable.'
      },
      {
        id: 'mv-3',
        tag: 'Core Concept',
        prompt: 'Why can mRNA vaccines be designed and updated much faster than traditional egg-grown or inactivated vaccines?',
        options: [
          'Once the pathogen’s genetic sequence is known, only the mRNA nucleotide sequence needs updating using the same manufacturing platform',
          'mRNA vaccines require zero clinical testing when updated',
          'They do not need refrigeration at any stage',
          'One mRNA strand automatically adapts to mutate alongside every virus'
        ],
        correctIndex: 0,
        rationale:
          'Traditional vaccines often require growing massive vats of live pathogen or optimizing unique protein purification steps. mRNA is synthesized cell-free from a digital sequence.',
        deepNote:
          'This platform flexibility is why mRNA is also being tested for personalized cancer vaccines.'
      },
      {
        id: 'mv-4',
        tag: 'Core Concept',
        prompt: 'After the injected mRNA degrades within a few days, what provides months or years of protection?',
        options: [
          'Leftover lipid nanoparticles circulating in the blood',
          'Memory B cells and Memory T cells trained during the initial immune response',
          'Continuous re-translation of the viral protein from your DNA',
          'Permanent fever elevation'
        ],
        correctIndex: 1,
        rationale:
          'The mRNA and antigen protein vanish quickly, but your adaptive immune system retains specialized memory B and T lymphocytes that mount a rapid counterattack upon real exposure.',
        deepNote:
          'Sore arms or mild fever after vaccination reflect that healthy innate immune signaling kicking off memory formation.'
      }
    ],
    relatedTopics: ['CRISPR-Cas9 Gene Editing', 'Adaptive vs. Innate Immunity', 'Antibody Affinity Maturation']
  },
  {
    slug: 'stoicism-vs-epicureanism',
    title: 'Stoicism vs. Epicureanism',
    keywords: ['stoicism', 'epicureanism', 'stoic', 'epicurus', 'hellenistic philosophy'],
    explanation: {
      bigPicture:
        'Both Stoicism and Epicureanism emerged in turbulent Hellenistic Greece with the same urgent goal: how to achieve inner tranquility (ataraxia) in an unpredictable world. Yet they took opposite paths—Stoics found peace through duty and virtue in public life, while Epicureans sought peace by stepping back into quiet friendship and simple pleasures.',
      mechanics: [
        'Stoicism (Zeno, Epictetus, Marcus Aurelius) holds that virtue (wisdom, courage, justice, temperance) is the sole true good. Everything external—wealth, reputation, health—is "indifferent" to your moral worth.',
        'Central to Stoicism is the Dichotomy of Control: distinguish ruthlessly between your own judgments/actions (yours to command) and external outcomes (not up to you).',
        'Epicureanism (Epicurus) holds that pleasure—specifically the absence of physical pain (aponia) and mental anxiety (ataraxia)—is the highest good, NOT wild luxury.',
        'Epicurus taught that chasing fame, politics, or gourmet luxury creates endless anxiety; true happiness comes from bread, water, good friends in a quiet garden, and shedding fear of death and angry gods.'
      ],
      pitfall:
        '"Stoic" today means suppressing emotions, and "Epicurean" means gourmet indulgence—both are exact opposites of the ancient philosophies. Real Stoics cultivate rational compassion and civic duty, while real Epicureans lived on bread, water, and cheese to avoid the stress of luxury.',
      keyTerms: [
        { term: 'Dichotomy of Control', definition: 'Stoic practice of investing energy only in your beliefs and choices, accepting external events with equanimity.' },
        { term: 'Ataraxia', definition: 'Untroubled peace of mind; sought by both schools through very different lifestyles.' },
        { term: 'Kinetic vs. Katastematic Pleasure', definition: 'Epicurean distinction: fleeting thrill of indulgence vs. deep, stable peace of lacking pain and fear.' }
      ]
    },
    questions: [
      {
        id: 'se-1',
        tag: 'Misconception',
        prompt: 'Why would Epicurus himself reject being called an "epicurean" in the modern sense of chasing fine dining and luxury?',
        options: [
          'He believed pleasure was evil and promoted fasting',
          'He taught that luxurious desires create anxiety and dependence, whereas simple needs + friendship yield maximum tranquility',
          'He argued only political power brings happiness',
          'He insisted virtue requires suffering'
        ],
        correctIndex: 1,
        rationale:
          'Epicurus defined the highest pleasure negatively: absence of bodily pain and mental turmoil. Fancy banquets breed fear of losing wealth; simple living makes contentment resilient.',
        deepNote:
          'Epicurus famously wrote: "Send me a pot of cheese, so that I may have a feast whenever I like."'
      },
      {
        id: 'se-2',
        tag: 'Core Concept',
        prompt: 'How do Stoics and Epicureans sharply disagree on civic and political engagement?',
        options: [
          'Stoics urge retiring to a private garden; Epicureans mandate running for senate',
          'Stoics see public duty and serving humanity as virtuous; Epicureans advise "live unnoticed" away from political anxiety',
          'Both schools forbid holding public office',
          'Both schools require military service'
        ],
        correctIndex: 1,
        rationale:
          'Stoics saw humans as rational citizens of a shared cosmopolis (e.g., Emperor Marcus Aurelius); Epicureans saw politics as a toxic arena of status anxiety and recommended quiet community.',
        deepNote:
          'Seneca (a Stoic) admired many Epicurean maxims about simplicity while still arguing a wise person engages in duty when able.'
      },
      {
        id: 'se-3',
        tag: 'Core Concept',
        prompt: 'In Stoic ethics, what does calling wealth or health "preferred indifferents" mean?',
        options: [
          'You should actively destroy your wealth and neglect your health',
          'They are naturally preferable when available, yet have zero bearing on whether you are a good or flourishing person',
          'They are the ultimate purpose of philosophy',
          'They are illusions created by the senses'
        ],
        correctIndex: 1,
        rationale:
          'A Stoic prefers health over sickness, just as anyone would—but because illness can strike a virtuous person, moral excellence (virtue) alone determines eudaimonia (flourishing).',
        deepNote:
          'This prevents both ascetic self-harm and panic when external fortune turns.'
      },
      {
        id: 'se-4',
        tag: 'Mechanism',
        prompt: 'How did Epicurus argue against fearing death ("Death is nothing to us")?',
        options: [
          'By promising an eternal reward in Elysium',
          'Because sensation ends at death: when we exist, death is not; when death exists, we are not',
          'Because the soul reincarnates immediately into a wiser body',
          'Because Stoic courage conquers the underworld'
        ],
        correctIndex: 1,
        rationale:
          'As a materialist atomist, Epicurus argued consciousness dissolves when the body’s atoms disperse—so death involves zero pain or experience, like the eternity before you were born.',
        deepNote:
          'Removing fear of divine punishment and death was central to Epicurean therapy.'
      }
    ],
    relatedTopics: ['Aristotle’s Virtue Ethics', 'Cognitive Behavioral Therapy & Stoicism', 'Existentialism']
  },
  {
    slug: 'dns-resolution',
    title: 'DNS & How Domain Names Resolve',
    keywords: ['dns', 'domain name system', 'nameserver', 'recursive resolver', 'ttl'],
    explanation: {
      bigPicture:
        'Humans remember names like example.com, while internet routers only route packets to numeric IP addresses like 93.184.216.34. DNS is the planet-scale, hierarchically cached phonebook that translates names to IPs in milliseconds without any single server holding the whole list.',
      mechanics: [
        'First your browser and OS check local caches. On a cache miss, your device asks a Recursive Resolver (run by your ISP, Cloudflare 1.1.1.1, or Google 8.8.8.8).',
        'If uncached, the recursive resolver walks the tree from right to left: it asks a Root Server (.) where ".com" lives, then asks the .com TLD Server where "example.com" lives.',
        'Finally it queries the Authoritative Nameserver for example.com, which returns the actual A (IPv4) or AAAA (IPv6) record.',
        'Every response includes a TTL (Time To Live) in seconds so resolvers cache the answer and avoid hammering root servers for every webpage click.'
      ],
      pitfall:
        'A slow website first-byte is often blamed on the web server when it is actually uncached DNS lookup latency—or conversely, migrating a server breaks for some users because old DNS records remain cached until their TTL expires.',
      keyTerms: [
        { term: 'Recursive Resolver', definition: 'Your network’s helper server that walks the DNS hierarchy on your behalf and caches results.' },
        { term: 'Authoritative Nameserver', definition: 'The final source of truth holding the actual DNS records for a specific domain.' },
        { term: 'TTL (Time To Live)', definition: 'Seconds a DNS answer may be cached before resolvers must re-verify it.' }
      ]
    },
    questions: [
      {
        id: 'dns-1',
        tag: 'Mechanism',
        prompt: 'When a recursive resolver has an empty cache and looks up "docs.example.org", in what order does it query the DNS hierarchy?',
        options: [
          'Authoritative → TLD (.org) → Root (.)',
          'Root (.) → TLD (.org) → Authoritative (example.org)',
          'TLD (.org) → Root (.) → Browser Cache',
          'Your OS queries all 13 root servers directly for every subdomain'
        ],
        correctIndex: 1,
        rationale:
          'DNS resolves right-to-left: Root points to .org TLD servers, which point to example.org’s authoritative nameservers, which return the record for docs.example.org.',
        deepNote:
          'Thanks to anycast routing, the "13 root server" addresses are actually backed by well over 1,500 physical clusters worldwide.'
      },
      {
        id: 'dns-2',
        tag: 'Application',
        prompt: 'You plan to migrate your website to a new server IP tomorrow with minimal downtime. What should you do 24 hours BEFORE the switch?',
        options: [
          'Raise the DNS TTL from 300 seconds to 86,400 seconds',
          'Lower the DNS TTL (e.g., to 60 seconds) ahead of time so old caches expire quickly during migration',
          'Delete the A record completely for one hour before adding the new one',
          'Switch from A records to CNAME records at the root apex'
        ],
        correctIndex: 1,
        rationale:
          'If your old TTL was 24 hours, resolvers will keep sending traffic to the old IP for up to 24 hours even after you update the record. Lowering TTL beforehand ensures rapid cutover.',
        deepNote:
          'Once migration succeeds, you can raise TTL back up to improve cache hit rates and resilience.'
      },
      {
        id: 'dns-3',
        tag: 'Core Concept',
        prompt: 'What is the difference between a Recursive Resolver and an Authoritative Nameserver?',
        options: [
          'Recursive resolvers only serve IPv6; authoritative servers only serve IPv4',
          'A recursive resolver hunts down answers across the hierarchy and caches them; an authoritative server owns and serves the zone’s official records',
          'Authoritative servers sit inside your browser; recursive resolvers run on ICANN’s main computer',
          'There is no difference—both terms describe any DNS server'
        ],
        correctIndex: 1,
        rationale:
          'The recursive resolver (like 1.1.1.1) does the legwork for clients; the authoritative server (like Route53 or Cloudflare DNS for your domain) holds the ground-truth zone file.',
        deepNote:
          'Separating recursion from authority keeps root/TLD servers fast and stateless while pushing caching near users.'
      },
      {
        id: 'dns-4',
        tag: 'Misconception',
        prompt: 'Why is standard unencrypted DNS over UDP port 53 considered a privacy gap, and what solves it?',
        options: [
          'DNS responses contain your HTTPS passwords; VPNs strip them',
          'Anyone observing your network path can see every domain name you visit in plaintext; DoH (DNS over HTTPS) or DoT encrypts the query',
          'UDP port 53 broadcasts your queries to every website you visit',
          'DNS queries always include your full URL path and query parameters'
        ],
        correctIndex: 1,
        rationale:
          'Classic DNS only asks for the domain (not the URL path), yet sends that domain in clear text. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt queries between your device and the resolver.',
        deepNote:
          'Note that TLS SNI in the subsequent HTTPS handshake can still reveal the hostname unless Encrypted Client Hello (ECH) is also used.'
      }
    ],
    relatedTopics: ['HTTP/3 & QUIC', 'TLS 1.3 & Certificates', 'Anycast Routing']
  }
];
