import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import InboxProductivityTools from './InboxProductivityTools';

jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: { error: false, data: [] } })
}));

describe('InboxProductivityTools', () => {
    beforeEach(() => {
        axios.post.mockClear();
    });

    it('closes the active panel when clicking outside the tools', async () => {
        const { container } = render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <InboxProductivityTools
                    tokens={{ token: 'token', username: 'agent', selected_project_id: 'project' }}
                    number="15551234567"
                    contactName="Alex"
                    messageInput=""
                    onMessageInputChange={jest.fn()}
                    slashKeyHandlerRef={{ current: null }}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Internal notes' }));
        expect(await screen.findByText('Visible to project agents only. Never sent to WhatsApp.')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        await waitFor(() => {
            expect(container.querySelector('section h3')).not.toBeInTheDocument();
        });
    });
});
