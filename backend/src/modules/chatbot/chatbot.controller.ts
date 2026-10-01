import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ChatbotService } from './chatbot.service';
import { SendChatMessageDto } from './dto';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Send a message to the AI assistant and get a reply' })
  @ApiResponse({ status: 200, description: 'Assistant reply' })
  @ApiResponse({ status: 503, description: 'Assistant not configured or unavailable' })
  @ApiResponse({ status: 429, description: 'Too many requests, try again shortly' })
  async sendMessage(@Body() dto: SendChatMessageDto) {
    const reply = await this.chatbotService.getReply(dto.message, dto.history);
    return { reply };
  }
}
