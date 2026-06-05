//
//  ConvoyChatView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct ConvoyChatView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    var convoy: Convoy
    @State private var draft = ""

    private let quickMessages = ["Fuel stop", "Pulling over", "Running late"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Convoy Chat", value: "Text MVP")

            VStack(spacing: 10) {
                ForEach(viewModel.messages) { message in
                    messageRow(message)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(quickMessages, id: \.self) { text in
                        Button(text) {
                            send(text)
                        }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.1), in: Capsule())
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Message \(convoy.name)", text: $draft)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                Button {
                    send(draft)
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.black)
                        .frame(width: 44, height: 44)
                        .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func messageRow(_ message: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 9) {
            if message.isSystem {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(SlipStreamStyle.accent)
                    .frame(width: 24, height: 24)
                    .background(SlipStreamStyle.accent.opacity(0.14), in: Circle())
            } else {
                Circle()
                    .fill(Color.white.opacity(0.16))
                    .frame(width: 24, height: 24)
                    .overlay(
                        Text(String(message.sender.prefix(1)).uppercased())
                            .font(.system(size: 10, weight: .black))
                    )
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(message.sender)
                        .font(.system(size: 12, weight: .black))
                    Text(message.timestamp)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.faint)
                }
                Text(message.text)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(message.isSystem ? SlipStreamStyle.muted : .white)
            }

            Spacer()
        }
    }

    private func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        viewModel.messages.append(ChatMessage(sender: "you", text: trimmed, timestamp: "Now"))
        draft = ""
    }
}
