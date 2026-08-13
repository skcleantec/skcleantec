/** Chrome 142+ Local Network Access — loopback 브릿지 fetch */
type RequestAddressSpace = 'local' | 'private' | 'loopback' | 'public';

interface RequestInit {
  targetAddressSpace?: RequestAddressSpace;
}
