import { ApproveProofDto, DepositProofDto, TransferFromProofDto, TransferProofDto } from "../../../dtos/generate-proof.dto";
import { generateApproveProof, generateDepositProof, generateTransferFromProof, generateTransferProof } from "../../../services/proof.service";
import { FastifyInstance } from 'fastify';

export default async function routes(fastify: FastifyInstance) {
  fastify.post('/transfer', async (request, reply) => {
    try {
      const body = request.body as TransferProofDto;
      const proofArray = await generateTransferProof(body);
      
      return reply.status(201).send(proofArray);
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/transfer-from', async (request, reply) => {
    try {
      const body = request.body as TransferFromProofDto;
      const proofArray = await generateTransferFromProof(body);
      
      return reply.status(201).send(proofArray);
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/approve', async (request, reply) => {
    try {
      const body = request.body as ApproveProofDto;
      const proofArray = await generateApproveProof(body);
      
      return reply.status(201).send(proofArray);
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/deposit', async (request, reply) => {
    try {
      const body = request.body as DepositProofDto;
      const proofArray = await generateDepositProof(body);
      
      return reply.status(201).send(proofArray);
    } catch (error) {
      throw error;
    }
  });
}
