const fetch = require('node-fetch');

class Nodes {
  constructor() {
    this.ready = false;
    this._init();
  }

  async _init() {
    const res = 
      await fetch('https://raw.githubusercontent.com/nycmeshnet/node-db/master/data/nodes.json')

    const nodes = 
      await res.json().then(nodes => nodes.map(({ id, status, coordinates, ...rest }) => {
        const [lon, lat,] = coordinates;
        return { id, status, lon, lat };
      }));

    this.nodes = nodes;

    this.nodesById = nodes.reduce((obj, node) => {
      obj[node.id] = node;
      return obj;
    }, {});

    // Mapping from a computed IP Address to Node ID
    // NOTE: nodes do not neccessarily actually have these IPs
    this.ip2Node = nodes.reduce((obj, { id }) => {
      obj[nodeToIp(id)] = id
      return obj;
    }, { '10.70.165.254': 2463 }); // Legacy Nodes

    this.ready = true

  }

  waitReady() {
    if(this.ready) {
      return;
    }
    return new Promise(resolve => setTimeout(resolve, 100))
    .then(this.waitReady.bind(this));
  }

  nodeIdFromIp(ipAddress) {
    const octets = ipAddress.split('.');
    if(ipAddress.startsWith('10.69')) {
      return octets.slice(2).join('');
    } else {
      const [lastOctet] = octets.slice(-1);
      return this.ip2Node[ipAddress];
    } 
  }
}

// Use bit-shift math to compute router IP for a given node
// NOTE: not all nodes use this formula
function nodeToIp(nodeId) {
  const cidr = 26;
  const secondOctet = (96 + (nodeId >> 10)) + 0;
  const thirdOctet = (nodeId >> 2) & 255 + 0;
  const fourthOctet = ((nodeId & 3) << 6 + 0) + 1;

  return `10.${secondOctet}.${thirdOctet}.${fourthOctet}`;
}


const nodes = new Nodes();


module.exports.ipToNode = async (event, context, callback) => {
  await nodes.waitReady();
  const { ipAddress } = event.pathParameters;
  const nodeId = nodes.nodeIdFromIp(ipAddress)
  if(!nodeId) {
    console.log('Node not found', nodeId);
    return { statusCode: 404 };
  }

  const node = nodes.nodesById[nodeId];
  return { statusCode: 200, body: JSON.stringify({ node }) };
};

// Quick self-test
module.exports.ipToNode({ pathParameters: { ipAddress: '10.97.135.193' } }).then(console.log)
